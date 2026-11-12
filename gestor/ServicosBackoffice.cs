using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace BXB
{
    // O Gestor controla os processos; os dados dos clientes passam apenas pela API de consulta.
    partial class Janela
    {
        readonly object guardaBackoffice = new object();
        Process processoBackoffice;
        bool aPrepararBackoffice, abrindoGestao, aFecharBackoffice, aLerRede;
        DateTime proximaTentativaBackoffice = DateTime.MinValue;
        string ultimoErroBackoffice;

        static string NormalizarPasta(string valor)
        {
            string completa = Path.GetFullPath(valor), volume = Path.GetPathRoot(completa);
            return completa.Length > volume.Length ? completa.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) : volume;
        }
        static bool PastaContem(string pasta, string candidata)
        {
            pasta = NormalizarPasta(pasta); candidata = NormalizarPasta(candidata);
            string prefixo = pasta.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal) ? pasta : pasta + Path.DirectorySeparatorChar;
            return candidata.Equals(pasta, StringComparison.OrdinalIgnoreCase) || candidata.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase);
        }

        static int PortaAmbiente(string nome, int alternativa)
        {
            int valor;
            string texto = Environment.GetEnvironmentVariable(nome);
            if (string.IsNullOrEmpty(texto)) return alternativa;
            if (!int.TryParse(texto, out valor) || valor < 1 || valor > 65535)
                throw new InvalidOperationException(nome + " tem de ser uma porta válida.");
            return valor;
        }

        static Dictionary<string, object> PedidoLocal(int porta, string metodo, string caminho, string chave, out string erro, int tempo = 4000)
        {
            erro = null;
            try
            {
                var pedido = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + porta + caminho);
                pedido.Method = metodo; pedido.Proxy = null; pedido.Timeout = tempo; pedido.ReadWriteTimeout = tempo;
                if (chave != null) pedido.Headers["Authorization"] = "Bearer " + chave;
                if (metodo == "POST")
                {
                    pedido.Headers["X-BXB"] = "1"; pedido.ContentType = "application/json";
                    byte[] corpo = Encoding.UTF8.GetBytes("{}"); pedido.ContentLength = corpo.Length;
                    using (var destino = pedido.GetRequestStream()) destino.Write(corpo, 0, corpo.Length);
                }
                using (var resposta = (HttpWebResponse)pedido.GetResponse())
                using (var leitor = new StreamReader(resposta.GetResponseStream(), Encoding.UTF8))
                {
                    var texto = new StringBuilder(); var parte = new char[4096]; int lidos;
                    while ((lidos = leitor.Read(parte, 0, parte.Length)) > 0)
                    {
                        if (texto.Length + lidos > 8 * 1024 * 1024) throw new InvalidOperationException("Resposta local demasiado grande.");
                        texto.Append(parte, 0, lidos);
                    }
                    return new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 }.Deserialize<Dictionary<string, object>>(texto.ToString());
                }
            }
            catch (WebException e)
            {
                using (var resposta = e.Response as HttpWebResponse)
                    erro = resposta != null ? "O serviço local recusou o pedido (HTTP " + (int)resposta.StatusCode + ")." : "O serviço local não responde.";
            }
            catch { erro = "Não foi possível comunicar com o serviço local."; }
            return null;
        }

        string LerChaveLocal(string pasta, string nome)
        {
            try
            {
                string chave = File.ReadAllText(Path.Combine(pasta, nome)).Trim();
                if (chave.Length != 64) return null;
                foreach (char c in chave) if (!Uri.IsHexDigit(c)) return null;
                return chave;
            }
            catch { return null; }
        }

        Dictionary<string, object> PedirBackoffice(string metodo, string caminho, out string erro)
        {
            string chave = LerChaveLocal(dados, "backoffice.chave");
            if (chave == null) { erro = "A chave do painel de gestão ainda não foi criada."; return null; }
            return PedidoLocal(portaBackoffice, metodo, caminho, chave, out erro);
        }

        bool SaudeBackoffice()
        {
            string erro; var estadoPainel = PedidoLocal(portaBackoffice, "GET", "/api/saude", null, out erro, 800);
            object assinatura;
            return estadoPainel != null && estadoPainel.TryGetValue("servidor", out assinatura) && (assinatura as string) == "bxb-backoffice";
        }

        bool GarantirBackoffice(out string erro)
        {
            lock (guardaBackoffice)
            {
                erro = null;
                if (aFecharBackoffice || aSair) { erro = "O Gestor está a fechar."; return false; }
                if (SaudeBackoffice()) return true;
                string fonte = Path.Combine(raiz, "backoffice", "servidor-backoffice.js");
                if (!File.Exists(fonte)) { erro = "O servidor do painel de gestão não está instalado."; return false; }
                try
                {
                    if (processoBackoffice == null || processoBackoffice.HasExited)
                    {
                        var inicio = new ProcessStartInfo("node", "\"" + fonte + "\"")
                        {
                            WorkingDirectory = raiz, UseShellExecute = false, CreateNoWindow = true,
                            RedirectStandardOutput = true, RedirectStandardError = true,
                            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
                        };
                        inicio.EnvironmentVariables["BXB_DADOS"] = dadosSite;
                        inicio.EnvironmentVariables["BXB_DADOS_BACKOFFICE"] = dados;
                        inicio.EnvironmentVariables["PORT_BACKOFFICE"] = portaBackoffice.ToString();
                        inicio.EnvironmentVariables["PORT_CONSULTA"] = portaConsulta.ToString();
                        inicio.EnvironmentVariables["NO_BROWSER"] = "1";
                        processoBackoffice = new Process { StartInfo = inicio, EnableRaisingEvents = true };
                        processoBackoffice.OutputDataReceived += (s, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Escrever("[gestão] " + e.Data, 0, false); };
                        processoBackoffice.ErrorDataReceived += (s, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Escrever("[gestão] " + e.Data, 1, false); };
                        processoBackoffice.Start(); processoBackoffice.BeginOutputReadLine(); processoBackoffice.BeginErrorReadLine();
                        Escrever("A ligar o painel de gestão independente…", 2);
                    }
                    for (int i = 0; i < 30; i++)
                    {
                        if (aFecharBackoffice || aSair) break;
                        if (SaudeBackoffice()) { Escrever("Painel de gestão disponível em http://127.0.0.1:" + portaBackoffice + "/", 2); return true; }
                        if (processoBackoffice.HasExited) break;
                        Thread.Sleep(150);
                    }
                    erro = "O painel de gestão não arrancou. Consulte as mensagens do Gestor.";
                }
                catch { erro = "Não foi possível iniciar o painel de gestão. Confirme o Node.js 22.5 ou superior."; }
                return false;
            }
        }

        void VigiarBackoffice()
        {
            if (captura != null || aSair || aFecharBackoffice || aPrepararBackoffice || DateTime.UtcNow < proximaTentativaBackoffice) return;
            aPrepararBackoffice = true;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                string erro; bool pronto = GarantirBackoffice(out erro);
                try { BeginInvoke(new Action(() =>
                {
                    aPrepararBackoffice = false; proximaTentativaBackoffice = DateTime.UtcNow.AddSeconds(pronto ? 5 : 15);
                    if (!pronto && erro != ultimoErroBackoffice) Escrever(erro, 1);
                    ultimoErroBackoffice = pronto ? null : erro;
                })); } catch { aPrepararBackoffice = false; }
            });
        }

        bool PararBackoffice(bool pararExterno = false)
        {
            aFecharBackoffice = true;
            lock (guardaBackoffice)
            {
                try
                {
                    bool proprio = processoBackoffice != null && !processoBackoffice.HasExited;
                    if (!proprio && (!pararExterno || !SaudeBackoffice())) return true;
                    string erro; PedirBackoffice("POST", "/api/desligar", out erro);
                    if (proprio)
                    {
                        if (!processoBackoffice.WaitForExit(9000)) { processoBackoffice.Kill(); processoBackoffice.WaitForExit(2000); }
                        if (!processoBackoffice.HasExited) return false;
                    }
                    else
                    {
                        DateTime limite = DateTime.UtcNow.AddSeconds(8);
                        while (DateTime.UtcNow < limite && SaudeBackoffice()) Thread.Sleep(150);
                    }
                    return !SaudeBackoffice();
                }
                catch { return false; }
                finally
                {
                    try { if (processoBackoffice != null && processoBackoffice.HasExited) processoBackoffice = null; } catch { }
                }
            }
        }

        void AtualizarRedeConsulta()
        {
            if (aLerRede || captura != null) return; aLerRede = true;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                string erro; var resposta = Pedir("GET", "/v1/rede?linhas=400", out erro);
                var linhas = new List<string>(); object lista;
                if (resposta != null && resposta.TryGetValue("linhas", out lista) && lista is IEnumerable)
                    foreach (object linha in (IEnumerable)lista) linhas.Add(Convert.ToString(linha));
                string novo = resposta == null ? "Servidor do site desligado ou consulta indisponível." : linhas.Count == 0 ? "Ainda não há ligações de outros aparelhos." : string.Join("\n", linhas.ToArray());
                try { BeginInvoke(new Action(() => { aLerRede = false; if ((tRede.Tag as string) != novo) { tRede.Tag = novo; tRede.Text = novo; tRede.SelectionStart = tRede.TextLength; tRede.ScrollToCaret(); } })); }
                catch { aLerRede = false; }
            });
        }
    }
}
