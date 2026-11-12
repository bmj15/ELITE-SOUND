// dinmeta Gestor — liga, desliga e acompanha o servidor (servidor.js), mostra os registos e abre a consola de gestão.
// Compilar: gestor\compilar.bat (usa o compilador C# que já vem com o Windows; não é preciso instalar nada).
// Fica na pasta do repositório como "BXB Gestor.exe" (fora do git: cada computador compila o seu).
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("dinmeta Gestor")]
[assembly: System.Reflection.AssemblyProduct("dinmeta Gestor")]
[assembly: System.Reflection.AssemblyCompany("BXB")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace BXB
{
    static class Programa
    {
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

        public static bool EmTeste { get { return Environment.GetEnvironmentVariable("BXB_MODO_TESTE") == "1" || Environment.GetEnvironmentVariable("PORT_CONSULTA") == "8897" || Environment.GetEnvironmentVariable("PORT_BACKOFFICE") == "8890"; } }
        public static string NomeInstancia { get { return "Local\\BXBGestor" + (EmTeste ? "-teste-8890" : ""); } }
        static bool AmbienteTesteValido()
        {
            if (!EmTeste) return true;
            foreach (string nome in new[] { "BXB_DADOS", "BXB_DADOS_BACKOFFICE" })
            {
                string valor = Environment.GetEnvironmentVariable(nome);
                if (string.IsNullOrEmpty(valor) || Path.GetFullPath(valor).IndexOf("\\TESTES-CODEX\\", StringComparison.OrdinalIgnoreCase) < 0) return false;
            }
            return Environment.GetEnvironmentVariable("PORT") == "8891" && Environment.GetEnvironmentVariable("PORT_REDE") == "8892" &&
                Environment.GetEnvironmentVariable("PORT_GESTAO") == "8898" && Environment.GetEnvironmentVariable("PORT_CONSULTA") == "8897" &&
                Environment.GetEnvironmentVariable("PORT_BACKOFFICE") == "8890";
        }

        [STAThread]
        static void Main(string[] args)
        {
            if (!AmbienteTesteValido()) { Environment.ExitCode = 2; return; }
            try { SetProcessDPIAware(); } catch { }
            string captura = null; bool bandeja = false;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--bandeja") bandeja = true;
                if (args[i] == "--captura" && i + 1 < args.Length) captura = args[i + 1];
            }
            // só um Gestor aberto: se já houver, mostra-o
            bool novo = true;
            Mutex unico = captura == null ? new Mutex(true, NomeInstancia, out novo) : null;
            if (!novo) { try { EventWaitHandle.OpenExisting(NomeInstancia + "-mostrar").Set(); } catch { } return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Janela(bandeja, captura));
            GC.KeepAlive(unico);
        }
    }

    // Geometria vetorial do SVG aprovado dinmeta-simbolo.svg (viewBox 224 x 180).
    // A palavra dinmeta é texto; Inter é usada quando está instalada neste computador.
    static class MarcaDinmeta
    {
        public static readonly string Fonte = EscolherFonte();
        public static string FonteDestaque { get { return Fonte == "Inter" ? "Inter" : "Segoe UI Semibold"; } }
        public static FontStyle EstiloDestaque { get { return Fonte == "Inter" ? FontStyle.Bold : FontStyle.Regular; } }
        static string EscolherFonte()
        {
            using (var fontes = new System.Drawing.Text.InstalledFontCollection())
                foreach (var familia in fontes.Families)
                    if (string.Equals(familia.Name, "Inter", StringComparison.OrdinalIgnoreCase)) return "Inter";
            return "Segoe UI";
        }
        public static void Desenhar(Graphics g, RectangleF destino, Color tinta)
        {
            var estado = g.Save();
            try
            {
                float escala = Math.Min(destino.Width / 224f, destino.Height / 180f);
                g.TranslateTransform(destino.X + (destino.Width - 224f * escala) / 2f, destino.Y + (destino.Height - 180f * escala) / 2f);
                g.ScaleTransform(escala, escala);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var d = CaminhoD()) using (var pincel = new SolidBrush(tinta)) g.FillPath(pincel, d);
                using (var m = CaminhoM()) using (var pincel = new SolidBrush(Color.FromArgb(139, 92, 246))) g.FillPath(pincel, m);
            }
            finally { g.Restore(estado); }
        }
        static GraphicsPath CaminhoD()
        {
            var p = new GraphicsPath(FillMode.Alternate);
            p.StartFigure();
            p.AddBezier(98.0f, 10.0f, 104.627f, 10.0f, 110.0f, 15.373f, 110.0f, 22.0f);
            p.AddLine(110.0f, 22.0f, 110.0f, 118.0f);
            p.AddBezier(110.0f, 118.0f, 110.0f, 145.614f, 88.51f, 168.0f, 62.0f, 168.0f);
            p.AddBezier(62.0f, 168.0f, 34.386f, 168.0f, 12.0f, 145.614f, 12.0f, 118.0f);
            p.AddBezier(12.0f, 118.0f, 12.0f, 90.386f, 34.386f, 68.0f, 62.0f, 68.0f);
            p.AddBezier(62.0f, 68.0f, 70.5f, 68.0f, 78.5f, 70.0f, 86.0f, 74.0f);
            p.AddLine(86.0f, 74.0f, 86.0f, 22.0f);
            p.AddBezier(86.0f, 22.0f, 86.0f, 15.373f, 91.373f, 10.0f, 98.0f, 10.0f);
            p.CloseFigure();
            p.StartFigure();
            p.AddBezier(62.0f, 90.0f, 46.536f, 90.0f, 34.0f, 102.536f, 34.0f, 118.0f);
            p.AddBezier(34.0f, 118.0f, 34.0f, 133.464f, 46.536f, 146.0f, 62.0f, 146.0f);
            p.AddBezier(62.0f, 146.0f, 77.464f, 146.0f, 90.0f, 133.464f, 90.0f, 118.0f);
            p.AddBezier(90.0f, 118.0f, 90.0f, 102.536f, 77.464f, 90.0f, 62.0f, 90.0f);
            p.CloseFigure();
            return p;
        }
        static GraphicsPath CaminhoM()
        {
            var p = new GraphicsPath(FillMode.Winding);
            p.StartFigure();
            p.AddBezier(14.549056f, 133.803776f, 29.0f, 117.0f, 48.0f, 113.0f, 68.0f, 112.0f);
            p.AddBezier(68.0f, 112.0f, 88.0f, 111.0f, 98.0f, 107.0f, 104.0f, 100.0f);
            p.AddBezier(104.0f, 100.0f, 108.0f, 95.0f, 110.0f, 89.0f, 110.0f, 83.0f);
            p.AddLine(110.0f, 83.0f, 110.0f, 43.0f);
            p.AddBezier(110.0f, 43.0f, 110.0f, 37.0f, 115.0f, 33.5f, 120.5f, 34.0f);
            p.AddBezier(120.5f, 34.0f, 123.3f, 34.2f, 125.1f, 35.9f, 126.56f, 38.12f);
            p.AddLine(126.56f, 38.12f, 156.6f, 84.7f);
            p.AddBezier(156.6f, 84.7f, 158.2f, 87.1666667f, 159.8f, 87.1666667f, 161.4f, 84.7f);
            p.AddLine(161.4f, 84.7f, 191.44f, 38.12f);
            p.AddBezier(191.44f, 38.12f, 192.9f, 35.9f, 195.1f, 34.0f, 199.0f, 34.0f);
            p.AddBezier(199.0f, 34.0f, 204.0f, 34.0f, 208.0f, 38.0f, 208.0f, 43.0f);
            p.AddLine(208.0f, 43.0f, 208.0f, 124.0f);
            p.AddBezier(208.0f, 124.0f, 208.0f, 128.971f, 203.971f, 133.0f, 199.0f, 133.0f);
            p.AddBezier(199.0f, 133.0f, 194.029f, 133.0f, 190.0f, 128.971f, 190.0f, 124.0f);
            p.AddLine(190.0f, 124.0f, 190.0f, 78.5f);
            p.AddBezier(190.0f, 78.5f, 190.0f, 75.1666667f, 189.1f, 74.9f, 187.3f, 77.7f);
            p.AddLine(187.3f, 77.7f, 167.0f, 109.2f);
            p.AddBezier(167.0f, 109.2f, 161.666667f, 117.466667f, 156.333333f, 117.466667f, 151.0f, 109.2f);
            p.AddLine(151.0f, 109.2f, 130.7f, 77.7f);
            p.AddBezier(130.7f, 77.7f, 128.9f, 74.9f, 128.0f, 75.1666667f, 128.0f, 78.5f);
            p.AddLine(128.0f, 78.5f, 128.0f, 83.0f);
            p.AddBezier(128.0f, 83.0f, 128.0f, 104.0f, 121.0f, 116.0f, 107.0f, 125.0f);
            p.AddBezier(107.0f, 125.0f, 94.0f, 133.0f, 83.0f, 136.0f, 67.0f, 137.0f);
            p.AddBezier(67.0f, 137.0f, 49.0f, 138.0f, 39.0f, 141.0f, 26.64475f, 153.35525f);
            p.AddBezier(26.64475f, 153.35525f, 21.2158f, 147.9263f, 17.02948f, 141.25472f, 14.549056f, 133.803776f);
            p.CloseFigure();
            return p;
        }
    }

    static class Cor
    {
        public static readonly Color Fundo = H("#07090d"), Fundo2 = H("#0c0f15"), Painel = H("#11151d"), Painel2 = H("#171c26"), Painel3 = H("#1e2430"),
            Linha = H("#232a37"), Linha2 = H("#2e3646"), Texto = H("#e9edf5"), Suave = H("#8a93a6"), Fraco = H("#5d6576"),
            Acento = H("#7c5cff"), Acento2 = H("#c056ff"), AcentoClaro = H("#a78bfa"), Ok = H("#22c55e"), Aviso = H("#f5a524"), Mau = H("#f04452");
        public static Color H(string h) { return ColorTranslator.FromHtml(h); }
        public static Color Mistura(Color a, Color b, float t)
        {
            return Color.FromArgb((int)(a.R * t + b.R * (1 - t)), (int)(a.G * t + b.G * (1 - t)), (int)(a.B * t + b.B * (1 - t)));
        }
    }

    // botão plano no estilo do sistema
    class Botao : Button
    {
        readonly bool primario;
        public Botao(string texto, bool primario)
        {
            this.primario = primario; Text = texto;
            FlatStyle = FlatStyle.Flat; Cursor = Cursors.Hand; AutoSize = true; AutoSizeMode = AutoSizeMode.GrowAndShrink;
            Padding = new Padding(8, 3, 8, 3); Margin = new Padding(0, 0, 8, 0); UseVisualStyleBackColor = false;
            Font = new Font(MarcaDinmeta.FonteDestaque, 9.5f, MarcaDinmeta.EstiloDestaque);
            BackColor = primario ? Cor.Acento : Cor.Painel; ForeColor = primario ? Color.White : Cor.Texto;
            FlatAppearance.BorderSize = 1; FlatAppearance.BorderColor = primario ? Cor.Acento : Cor.Linha2;
            FlatAppearance.MouseOverBackColor = primario ? Cor.H("#8d71ff") : Cor.Painel2;
            FlatAppearance.MouseDownBackColor = primario ? Cor.H("#6a4cf0") : Cor.Painel3;
        }
        protected override void OnEnabledChanged(EventArgs e)
        {
            base.OnEnabledChanged(e);
            BackColor = Enabled ? (primario ? Cor.Acento : Cor.Painel) : Cor.Fundo2;
            FlatAppearance.BorderColor = Enabled ? (primario ? Cor.Acento : Cor.Linha2) : Cor.Linha;
        }
    }

    // separador da barra (Servidor, Rede, Endereços)
    class Aba : Control
    {
        public bool Ativa;
        public Aba(string texto)
        {
            Text = texto; Cursor = Cursors.Hand; Font = new Font(MarcaDinmeta.FonteDestaque, 9.5f, MarcaDinmeta.EstiloDestaque);
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            Margin = new Padding(0, 0, 4, 0);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.Clear(Parent != null ? Parent.BackColor : Cor.Fundo2);
            TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, Ativa ? Cor.Texto : Cor.Suave, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            if (Ativa) using (var b = new SolidBrush(Cor.Acento)) e.Graphics.FillRectangle(b, 6, Height - 3, Width - 12, 3);
        }
    }

    class Saude
    {
        public int Pid; public long Arranque; public string Versao;
        public List<KeyValuePair<string, string>> Enderecos = new List<KeyValuePair<string, string>>();
    }

    enum Estado { Desligado, AArrancar, Ligado, LigadoFora, SemResposta, ADesligar }

    partial class Janela : Form
    {
        [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
        [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr h);
        [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)] static extern int SetWindowTheme(IntPtr h, string app, string id);
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int valor, int tamanho);

        const string ASSINATURA = "grupo-bxb-servidor";
        readonly string raiz, dados, dadosSite, ficheiroIni, captura;
        readonly int portaConsulta, portaBackoffice;
        readonly bool modoTeste;
        readonly float escala;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        readonly Dictionary<string, string> ini = new Dictionary<string, string>();

        Process proc; DateTime inicioProc; bool aParar, verificando, aSair, avisouBandeja;
        Estado estado = Estado.Desligado; Saude saude;
        Panel topo, conteudo; Label info;
        Botao bLigar, bDesligar, bReiniciar, bSite, bConsola, bAtualizar, bPasta;
        Aba aServidor, aRede, aEnderecos;
        RichTextBox tServidor, tRede, tEnderecos;
        CheckBox cWindows, cLigar, cBandeja;
        NotifyIcon bandeja; ContextMenuStrip menu; ToolStripMenuItem mLigar, mDesligar, mReiniciar, mConsola, mSite;
        System.Windows.Forms.Timer relogio, relogioRede;
        Icon iconeBase; IntPtr iconeAtual = IntPtr.Zero;
        readonly bool comecarNaBandeja;
        EventWaitHandle sinalMostrar;

        int S(float px) { return (int)Math.Round(px * escala); }

        public Janela(bool naBandeja, string captura)
        {
            this.captura = captura; comecarNaBandeja = naBandeja && captura == null;
            using (var g = CreateGraphics()) escala = g.DpiX / 96f;
            // a pasta do repositório é a do .exe (ou a de cima, se o .exe estiver em gestor\)
            raiz = Path.GetDirectoryName(Application.ExecutablePath);
            if (!File.Exists(Path.Combine(raiz, "servidor.js")) && File.Exists(Path.Combine(raiz, "..", "servidor.js"))) raiz = Path.GetFullPath(Path.Combine(raiz, ".."));
            modoTeste = Programa.EmTeste;
            string envDados = Environment.GetEnvironmentVariable("BXB_DADOS");
            string envBackoffice = Environment.GetEnvironmentVariable("BXB_DADOS_BACKOFFICE");
            dadosSite = NormalizarPasta(!string.IsNullOrEmpty(envDados) ? envDados : Path.Combine(raiz, "..", "..", "DADOS-SERVIDOR"));
            dados = NormalizarPasta(!string.IsNullOrEmpty(envBackoffice) ? envBackoffice : Path.Combine(raiz, "..", "..", "DADOS-BACKOFFICE"));
            if (PastaContem(dadosSite, dados) || PastaContem(dados, dadosSite) || PastaContem(raiz, dados))
                throw new InvalidOperationException("Os dados do Gestor têm de ficar separados dos dados do site.");
            portaConsulta = PortaAmbiente("PORT_CONSULTA", 8097);
            portaBackoffice = PortaAmbiente("PORT_BACKOFFICE", 8100);
            if (portaConsulta == portaBackoffice || portaConsulta == 8099 || portaBackoffice == 8099)
                throw new InvalidOperationException("Use portas próprias para a consulta e o back-office.");
            ficheiroIni = Path.Combine(dados, "gestor.ini");
            LerIni();
            try { iconeBase = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { iconeBase = SystemIcons.Application; }
            Montar();
            if (captura == null)
            {
                Escrever("dinmeta Gestor aberto. Repositório: " + raiz, 2);
                Escrever("Dados: " + dados, 2);
                if (!File.Exists(Path.Combine(raiz, "servidor.js"))) Escrever("Não encontrei servidor.js. O dinmeta Gestor (ficheiro BXB Gestor.exe) tem de estar na pasta do repositório.", 1);
                sinalMostrar = new EventWaitHandle(false, EventResetMode.AutoReset, Programa.NomeInstancia + "-mostrar");
                var t = new Thread(() => { while (true) { sinalMostrar.WaitOne(); try { BeginInvoke(new Action(Mostrar)); } catch { return; } } });
                t.IsBackground = true; t.Start();
                IniciarAcompanhamento();
            }
        }

        /* ---------------- interface ---------------- */
        void Montar()
        {
            Text = modoTeste ? "dinmeta Gestor - TESTE" : "dinmeta Gestor"; Icon = iconeBase; BackColor = Cor.Fundo2; ForeColor = Cor.Texto;
            Font = new Font(MarcaDinmeta.Fonte, 9.5f); Size = new Size(S(1000), S(660)); MinimumSize = new Size(S(780), S(480));
            StartPosition = FormStartPosition.CenterScreen;

            topo = new DoubleBufferedPanel { Dock = DockStyle.Top, Height = S(84), BackColor = Cor.Fundo };
            topo.Paint += PintarTopo; topo.Resize += (s, e) => topo.Invalidate();

            var barra = new FlowLayoutPanel { Dock = DockStyle.Top, Height = S(58), BackColor = Cor.Fundo, Padding = new Padding(S(20), S(10), S(20), S(10)), WrapContents = false, AutoScroll = false };
            bLigar = new Botao("Ligar", true); bDesligar = new Botao("Desligar", false); bReiniciar = new Botao("Reiniciar", false);
            bSite = new Botao("Abrir o site", false); bConsola = new Botao("Painel de gestão", true);
            bAtualizar = new Botao("Atualizar código", false); bPasta = new Botao("Pasta dos dados", false);
            bLigar.Click += (s, e) => Ligar(); bDesligar.Click += (s, e) => Desligar(null); bReiniciar.Click += (s, e) => Reiniciar();
            bSite.Click += (s, e) => AbrirSite(); bConsola.Click += (s, e) => AbrirConsola(); bAtualizar.Click += (s, e) => AtualizarCodigo();
            bPasta.Click += (s, e) => { try { Directory.CreateDirectory(dados); Process.Start("explorer.exe", "\"" + dados + "\""); } catch (Exception x) { Escrever(x.Message, 1); } };
            barra.Controls.AddRange(new Control[] { bLigar, bDesligar, bReiniciar, Separador(), bConsola, bSite, Separador(), bAtualizar, bPasta });

            var linhaAbas = new FlowLayoutPanel { Dock = DockStyle.Top, Height = S(40), BackColor = Cor.Fundo2, Padding = new Padding(S(16), S(4), S(16), 0), WrapContents = false };
            aServidor = new Aba("Servidor") { Size = new Size(S(92), S(34)) }; aRede = new Aba("Rede") { Size = new Size(S(70), S(34)) }; aEnderecos = new Aba("Endereços") { Size = new Size(S(98), S(34)) };
            aServidor.Click += (s, e) => Separador(0); aRede.Click += (s, e) => Separador(1); aEnderecos.Click += (s, e) => Separador(2);
            linhaAbas.Controls.AddRange(new Control[] { aServidor, aRede, aEnderecos });
            var risco = new Panel { Dock = DockStyle.Top, Height = 1, BackColor = Cor.Linha };

            conteudo = new Panel { Dock = DockStyle.Fill, BackColor = Cor.Fundo2, Padding = new Padding(S(20), S(14), S(20), S(12)) };
            var moldura = new Panel { Dock = DockStyle.Fill, BackColor = Cor.Linha, Padding = new Padding(1) };
            var dentro = new Panel { Dock = DockStyle.Fill, BackColor = Cor.Fundo, Padding = new Padding(S(12), S(10), S(4), S(6)) };
            tServidor = Texto(false); tRede = Texto(false); tEnderecos = Texto(true);
            tEnderecos.LinkClicked += (s, e) => { try { Process.Start(e.LinkText); } catch { } };
            dentro.Controls.AddRange(new Control[] { tServidor, tRede, tEnderecos });
            moldura.Controls.Add(dentro); conteudo.Controls.Add(moldura);

            var rodape = new Panel { Dock = DockStyle.Bottom, Height = S(44), BackColor = Cor.Fundo, Padding = new Padding(S(18), 0, S(20), 0) };
            var opcoes = new FlowLayoutPanel { Dock = DockStyle.Left, AutoSize = true, WrapContents = false, BackColor = Cor.Fundo, Padding = new Padding(0, S(11), 0, 0) };
            cLigar = Opcao("Ligar o servidor ao abrir", Ini("ligarAoAbrir", "1") == "1");
            cBandeja = Opcao("Fechar para a bandeja", Ini("bandeja", "1") == "1");
            cWindows = Opcao("Abrir com o Windows", !modoTeste && ArrancaComWindows());
            cWindows.Enabled = !modoTeste;
            cLigar.CheckedChanged += (s, e) => GravarIni("ligarAoAbrir", cLigar.Checked ? "1" : "0");
            cBandeja.CheckedChanged += (s, e) => GravarIni("bandeja", cBandeja.Checked ? "1" : "0");
            cWindows.CheckedChanged += (s, e) => DefinirArranque(cWindows.Checked);
            opcoes.Controls.AddRange(new Control[] { cLigar, cBandeja, cWindows });
            info = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight, ForeColor = Cor.Suave, BackColor = Cor.Fundo, AutoEllipsis = true };
            rodape.Controls.Add(info); rodape.Controls.Add(opcoes);
            var risco2 = new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Cor.Linha };

            Controls.Add(conteudo); Controls.Add(risco); Controls.Add(linhaAbas); Controls.Add(barra); Controls.Add(topo);
            Controls.Add(risco2); Controls.Add(rodape);

            // bandeja (junto ao relógio do Windows)
            menu = new ContextMenuStrip { ShowImageMargin = false };
            menu.Items.Add("Abrir o dinmeta Gestor", null, (s, e) => Mostrar()).Font = new Font(MarcaDinmeta.Fonte, 9.5f, FontStyle.Bold);
            mConsola = (ToolStripMenuItem)menu.Items.Add("Painel de gestão", null, (s, e) => AbrirConsola());
            mSite = (ToolStripMenuItem)menu.Items.Add("Abrir o site", null, (s, e) => AbrirSite());
            menu.Items.Add(new ToolStripSeparator());
            mLigar = (ToolStripMenuItem)menu.Items.Add("Ligar o servidor", null, (s, e) => Ligar());
            mDesligar = (ToolStripMenuItem)menu.Items.Add("Desligar o servidor", null, (s, e) => Desligar(null));
            mReiniciar = (ToolStripMenuItem)menu.Items.Add("Reiniciar o servidor", null, (s, e) => Reiniciar());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Sair", null, (s, e) => Sair());
            bandeja = new NotifyIcon { Icon = iconeBase, Text = Text, ContextMenuStrip = menu, Visible = captura == null };
            bandeja.DoubleClick += (s, e) => Mostrar();
            bandeja.BalloonTipClicked += (s, e) => Mostrar();

            Separador(0);
            AtualizarEstado();
        }

        Panel Separador() { return new Panel { Width = 1, Height = S(26), BackColor = Cor.Linha2, Margin = new Padding(S(4), S(3), S(12), 0) }; }
        RichTextBox Texto(bool links)
        {
            var t = new RichTextBox { Dock = DockStyle.Fill, BorderStyle = BorderStyle.None, ReadOnly = true, BackColor = Cor.Fundo, ForeColor = Cor.Texto,
                Font = new Font("Consolas", 9.75f), DetectUrls = links, WordWrap = true, ScrollBars = RichTextBoxScrollBars.Vertical, HideSelection = false };
            t.HandleCreated += (s, e) => { try { SetWindowTheme(t.Handle, "DarkMode_Explorer", null); } catch { } };
            return t;
        }
        CheckBox Opcao(string texto, bool marcada)
        {
            return new CheckBox { Text = texto, Checked = marcada, AutoSize = true, ForeColor = Cor.Suave, BackColor = Cor.Fundo, Margin = new Padding(0, 0, S(18), 0),
                FlatStyle = FlatStyle.Standard, Cursor = Cursors.Hand };
        }
        void Separador(int i)
        {
            aServidor.Ativa = i == 0; aRede.Ativa = i == 1; aEnderecos.Ativa = i == 2;
            tServidor.Visible = i == 0; tRede.Visible = i == 1; tEnderecos.Visible = i == 2;
            aServidor.Invalidate(); aRede.Invalidate(); aEnderecos.Invalidate();
            if (i == 1) LerRede(); if (i == 2) PintarEnderecos();
        }

        string TextoEstado()
        {
            switch (estado)
            {
                case Estado.AArrancar: return "A arrancar…";
                case Estado.Ligado: return "Ligado";
                case Estado.LigadoFora: return "Ligado noutra janela";
                case Estado.SemResposta: return "Não responde";
                case Estado.ADesligar: return "A desligar…";
                default: return "Desligado";
            }
        }
        Color CorEstado()
        {
            switch (estado)
            {
                case Estado.Ligado: case Estado.LigadoFora: return Cor.Ok;
                case Estado.AArrancar: case Estado.ADesligar: return Cor.Aviso;
                case Estado.SemResposta: return Cor.Mau;
                default: return Cor.Suave;
            }
        }
        bool Ligado { get { return estado == Estado.Ligado || estado == Estado.LigadoFora; } }
        bool Nosso { get { try { return proc != null && !proc.HasExited; } catch { return false; } } }

        static GraphicsPath Redondo(Rectangle r, int raio)
        {
            var p = new GraphicsPath(); int d = raio * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90); p.CloseFigure(); return p;
        }
        void PintarTopo(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.Clear(Cor.Fundo);
            MarcaDinmeta.Desenhar(g, new RectangleF(S(18), S(18), S(58), S(48)), Cor.Texto);
            using (var f = new Font(MarcaDinmeta.FonteDestaque, 14f, MarcaDinmeta.EstiloDestaque)) TextRenderer.DrawText(g, "dinmeta Gestor", f, new Point(S(86), S(12)), Cor.Texto);
            using (var f = new Font(MarcaDinmeta.Fonte, 9f)) TextRenderer.DrawText(g, "Servidor, registos e painel de gestão", f, new Point(S(88), S(40)), Cor.Suave);
            using (var f = new Font(MarcaDinmeta.Fonte, 8f)) TextRenderer.DrawText(g, "Desenvolvido pela BXB", f, new Point(S(88), S(61)), Cor.Suave);
            // estado à direita
            string t = TextoEstado(); Color c = CorEstado();
            using (var f = new Font(MarcaDinmeta.FonteDestaque, 9.5f, MarcaDinmeta.EstiloDestaque))
            {
                Size ts = TextRenderer.MeasureText(g, t, f);
                int h = S(32), w = ts.Width + S(38); var rp = new Rectangle(topo.Width - w - S(20), S(26), w, h);
                using (var p = Redondo(rp, h / 2)) using (var b = new SolidBrush(Cor.Mistura(c, Cor.Fundo, 0.15f))) g.FillPath(b, p);
                using (var b = new SolidBrush(c)) g.FillEllipse(b, rp.X + S(14), rp.Y + h / 2 - S(4), S(8), S(8));
                TextRenderer.DrawText(g, t, f, new Rectangle(rp.X + S(28), rp.Y, w - S(30), h), c, TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
            }
            using (var pen = new Pen(Cor.Linha)) g.DrawLine(pen, 0, topo.Height - 1, topo.Width, topo.Height - 1);
        }

        void AtualizarEstado()
        {
            bool lig = Ligado, ocupado = estado == Estado.ADesligar || estado == Estado.AArrancar;
            bLigar.Enabled = mLigar.Enabled = estado == Estado.Desligado;
            bDesligar.Enabled = mDesligar.Enabled = estado != Estado.Desligado && estado != Estado.ADesligar;
            bReiniciar.Enabled = mReiniciar.Enabled = lig || estado == Estado.SemResposta;
            bSite.Enabled = mSite.Enabled = lig; bConsola.Enabled = mConsola.Enabled = !abrindoGestao && !aSair;
            bAtualizar.Enabled = !ocupado;
            if (lig && saude != null)
                info.Text = "Processo " + saude.Pid + " · ligado às " + DateTimeOffset.FromUnixTimeMilliseconds(saude.Arranque).LocalDateTime.ToString("HH:mm") +
                    (saude.Versao != null ? " · versão " + saude.Versao : "") + (estado == Estado.LigadoFora ? " · aberto fora do Gestor" : "");
            else info.Text = estado == Estado.Desligado ? "Servidor desligado" : TextoEstado();
            topo.Invalidate();
            if (bandeja != null) { bandeja.Text = (modoTeste ? "dinmeta Gestor TESTE · " : "dinmeta Gestor · ") + TextoEstado(); IconeBandeja(); }
            if (tEnderecos.Visible) PintarEnderecos();
        }
        // ícone da bandeja com um ponto: verde ligado, amarelo a mudar, vermelho sem resposta, cinzento desligado
        Color ultimaCorIcone = Color.Empty;
        void IconeBandeja()
        {
            Color c = CorEstado(); if (c == ultimaCorIcone) return; ultimaCorIcone = c;
            using (var bmp = new Bitmap(32, 32))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    using (var ic = new Icon(iconeBase, 32, 32)) g.DrawIcon(ic, new Rectangle(0, 0, 32, 32));
                    using (var b = new SolidBrush(Cor.Fundo)) g.FillEllipse(b, 17, 17, 15, 15);
                    using (var b = new SolidBrush(c)) g.FillEllipse(b, 19, 19, 11, 11);
                }
                IntPtr h = bmp.GetHicon(); var novo = Icon.FromHandle(h); bandeja.Icon = novo;
                if (iconeAtual != IntPtr.Zero) DestroyIcon(iconeAtual); iconeAtual = h;
            }
        }

        /* ---------------- registos ---------------- */
        void Escrever(string texto, int tipo, bool persistir = true) // 0 servidor, 1 erro, 2 mensagem do Gestor
        {
            if (IsDisposed) return;
            if (InvokeRequired) { try { BeginInvoke(new Action<string, int, bool>(Escrever), texto, tipo, persistir); } catch { } return; }
            string h = DateTime.Now.ToString("HH:mm:ss");
            if (persistir) GravarLog(texto, tipo);
            var t = tServidor;
            if (t.TextLength > 400000) { t.ReadOnly = false; t.Select(0, t.GetFirstCharIndexFromLine(t.Lines.Length / 3)); t.SelectedText = ""; t.ReadOnly = true; }
            bool fundo = !t.Focused || t.SelectionStart >= t.TextLength - 1;
            t.SelectionStart = t.TextLength; t.SelectionLength = 0;
            t.SelectionColor = Cor.Fraco; t.AppendText(h + "  ");
            t.SelectionColor = tipo == 1 ? Cor.Mau : tipo == 2 ? Cor.AcentoClaro : (texto.IndexOf("erro", StringComparison.OrdinalIgnoreCase) >= 0 || texto.Contains("[aviso]") ? Cor.Aviso : Cor.Texto);
            t.AppendText(texto.TrimEnd() + "\n");
            if (fundo) { t.SelectionStart = t.TextLength; t.ScrollToCaret(); }
        }
        // cópia própria em DADOS-BACKOFFICE\servidor.log (até 5 MB; depois passa a servidor.log.1)
        void GravarLog(string texto, int tipo)
        {
            if (captura != null) return;
            try
            {
                Directory.CreateDirectory(dados); string f = Path.Combine(dados, "servidor.log");
                var fi = new FileInfo(f); if (fi.Exists && fi.Length > 5 * 1024 * 1024) { string ant = f + ".1"; if (File.Exists(ant)) File.Delete(ant); File.Move(f, ant); }
                File.AppendAllText(f, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + (tipo == 1 ? " [erro] " : tipo == 2 ? " [gestor] " : " ") + texto.TrimEnd() + Environment.NewLine, new UTF8Encoding(false));
            }
            catch { }
        }
        void LerRede() { AtualizarRedeConsulta(); }
        void PintarEnderecos()
        {
            var t = tEnderecos; t.Clear();
            if (!Ligado || saude == null) { t.SelectionColor = Cor.Suave; t.AppendText("Ligue o servidor para ver os endereços.\n\n"); }
            else foreach (var e in saude.Enderecos)
                {
                    t.SelectionColor = Cor.Suave; t.AppendText(e.Key + "\n");
                    t.SelectionColor = Cor.AcentoClaro; t.AppendText("  " + e.Value + "\n\n");
                }
            t.SelectionColor = Cor.Suave; t.AppendText("Dados do Gestor e do back-office\n"); t.SelectionColor = Cor.Texto; t.AppendText("  " + dados + "\n\n");
            t.SelectionColor = Cor.Suave; t.AppendText("Repositório\n"); t.SelectionColor = Cor.Texto; t.AppendText("  " + raiz + "\n");
        }

        /* ---------------- servidor ---------------- */
        Saude LerSaude()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + portaConsulta + "/v1/saude");
                req.Timeout = 1500; req.ReadWriteTimeout = 1500; req.Proxy = null;
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                {
                    var d = json.Deserialize<Dictionary<string, object>>(sr.ReadToEnd());
                    object a; if (!d.TryGetValue("servidor", out a) || (a as string) != ASSINATURA) return null;
                    var s = new Saude { Pid = Convert.ToInt32(d["pid"]), Arranque = Convert.ToInt64(d["arranque"]), Versao = d.ContainsKey("versao") ? d["versao"] as string : null };
                    object l; if (d.TryGetValue("enderecos", out l) && l is IEnumerable)
                        foreach (object o in (IEnumerable)l) { var e = o as Dictionary<string, object>; if (e != null && Convert.ToString(e["nome"]).IndexOf("Consola", StringComparison.OrdinalIgnoreCase) < 0) s.Enderecos.Add(new KeyValuePair<string, string>(e["nome"] as string, e["url"] as string)); }
                    return s;
                }
            }
            catch { return null; }
        }
        Dictionary<string, object> Pedir(string metodo, string caminho, out string erro)
        {
            erro = null;
            for (int tentativa = 0; tentativa < 2; tentativa++)
            {
                string chave = LerChaveLocal(dadosSite, "consulta.chave");
                if (chave == null) { erro = "Não encontrei a chave da API de consulta."; return null; }
                var resposta = PedidoLocal(portaConsulta, metodo, caminho, chave, out erro);
                if (resposta != null || erro == null || erro.IndexOf("401", StringComparison.Ordinal) < 0) return resposta;
            }
            return null;
        }

        void Verificar()
        {
            if (verificando || captura != null) return; verificando = true;
            VigiarBackoffice();
            ThreadPool.QueueUserWorkItem(_ =>
            {
                var s = LerSaude();
                try { BeginInvoke(new Action(() => { verificando = false; Aplicar(s); })); } catch { verificando = false; }
            });
        }
        void Aplicar(Saude s)
        {
            var antes = estado; saude = s;
            if (estado == Estado.ADesligar && (s != null || Nosso)) { AtualizarEstado(); return; }
            if (s != null) estado = Nosso && proc.Id == s.Pid ? Estado.Ligado : Nosso ? Estado.Ligado : Estado.LigadoFora;
            else if (Nosso) estado = (DateTime.Now - inicioProc).TotalSeconds < 25 ? Estado.AArrancar : Estado.SemResposta;
            else estado = Estado.Desligado;
            if (antes != estado)
            {
                if (estado == Estado.Ligado && antes == Estado.AArrancar) Escrever("Servidor ligado.", 2);
                if (estado == Estado.LigadoFora && antes == Estado.Desligado) Escrever("O servidor já está ligado noutra janela (por exemplo, pelo ABRIR SISTEMA.bat).", 2);
                if (estado == Estado.SemResposta) Escrever("O servidor não responde há mais de 25 segundos.", 1);
            }
            AtualizarEstado();
        }

        void Ligar()
        {
            if (estado != Estado.Desligado) return;
            if (!File.Exists(Path.Combine(raiz, "servidor.js"))) { Escrever("Não encontrei servidor.js em " + raiz + ".", 1); return; }
            var psi = new ProcessStartInfo("node", "\"" + Path.Combine(raiz, "servidor.js") + "\"")
            {
                WorkingDirectory = raiz, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
            };
            psi.EnvironmentVariables["NO_BROWSER"] = "1"; psi.EnvironmentVariables["BXB_GESTOR"] = "1";
            psi.EnvironmentVariables["BXB_DADOS"] = dadosSite;
            try
            {
                var p = new Process { StartInfo = psi, EnableRaisingEvents = true };
                p.OutputDataReceived += (s, e) => { if (e.Data != null && e.Data.Trim().Length > 0) Escrever(e.Data, 0, false); };
                p.ErrorDataReceived += (s, e) => { if (e.Data != null && e.Data.Trim().Length > 0) Escrever(e.Data, 1, false); };
                p.Exited += (s, e) => { try { BeginInvoke(new Action(() => Parou(p))); } catch { } };
                p.Start(); p.BeginOutputReadLine(); p.BeginErrorReadLine();
                proc = p; inicioProc = DateTime.Now; aParar = false; estado = Estado.AArrancar;
                Escrever("A ligar o servidor (node servidor.js)…", 2); AtualizarEstado(); Verificar();
            }
            catch (Win32Exception)
            {
                Escrever("O Node.js não está instalado (ou não está no PATH).", 1);
                if (MessageBox.Show(this, "O Node.js não está instalado.\n\nÉ preciso para o servidor. Abrir a página de download? Instale a versão LTS e volte a ligar.", "dinmeta Gestor", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                    try { Process.Start("https://nodejs.org/"); } catch { }
            }
            catch (Exception x) { Escrever("Não foi possível ligar: " + x.Message, 1); }
        }
        void Parou(Process p)
        {
            int codigo = 0; try { codigo = p.ExitCode; } catch { }
            if (p != proc) return;
            proc = null;
            if (aParar) Escrever("Servidor desligado.", 2);
            else
            {
                Escrever("O servidor parou" + (codigo != 0 ? " com um erro (código " + codigo + "). Veja as linhas acima." : "."), codigo != 0 ? 1 : 2);
                if (codigo != 0 && bandeja.Visible && !Visible) bandeja.ShowBalloonTip(5000, "dinmeta Gestor", "O servidor parou com um erro.", ToolTipIcon.Error);
            }
            Verificar();
        }
        // desliga com ordem (pede ao servidor para fechar); se não parar em 6 s e for nosso, termina o processo
        void Desligar(Action depois)
        {
            if (estado == Estado.Desligado || estado == Estado.ADesligar) { if (depois != null) depois(); return; }
            estado = Estado.ADesligar; aParar = true; AtualizarEstado(); Escrever("A desligar o servidor…", 2);
            var p = proc;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                string erro; Pedir("POST", "/v1/desligar", out erro);
                for (int i = 0; i < 30; i++)
                {
                    bool vivo = p != null ? !p.HasExited : LerSaude() != null;
                    if (!vivo) break; Thread.Sleep(200);
                }
                if (p != null && !p.HasExited) { try { p.Kill(); p.WaitForExit(3000); } catch { } }
                var aindaLigado = LerSaude();
                bool falhou = (p != null && !p.HasExited) || aindaLigado != null;
                try
                {
                    BeginInvoke(new Action(() =>
                    {
                        if (falhou)
                        {
                            aParar = false;
                            Escrever("O servidor continua ligado. A operação foi cancelada; não será iniciada outra instância.", 1);
                            Aplicar(aindaLigado); return;
                        }
                        if (p == null) Escrever("Servidor desligado.", 2);
                        if (proc == p) proc = null;
                        estado = Estado.Desligado; saude = null; AtualizarEstado(); Verificar();
                        if (depois != null) depois();
                    }));
                }
                catch { }
            });
        }
        void Reiniciar(bool ligarSite = true)
        {
            Escrever("A reiniciar o site e o painel de gestão…", 2);
            Desligar(() => ThreadPool.QueueUserWorkItem(_ =>
            {
                bool parou = PararBackoffice(true);
                aFecharBackoffice = false;
                try { BeginInvoke(new Action(() =>
                {
                    proximaTentativaBackoffice = DateTime.MinValue;
                    if (!parou) Escrever("Não foi possível reiniciar o painel de gestão. O processo existente foi preservado.", 1);
                    VigiarBackoffice();
                    if (ligarSite) Ligar();
                })); } catch { }
            }));
        }

        void AbrirSite()
        {
            string url = saude != null && saude.Enderecos.Count > 0 ? saude.Enderecos[0].Value : "http://localhost/";
            try { Process.Start(url); } catch (Exception x) { Escrever(x.Message, 1); }
        }
        // O bilhete é emitido pelo back-office e consumido uma única vez, sem aparecer nos registos.
        void AbrirConsola()
        {
            if (abrindoGestao) return;
            abrindoGestao = true; AtualizarEstado();
            ThreadPool.QueueUserWorkItem(_ =>
            {
                string erro; Dictionary<string, object> resposta = null;
                if (GarantirBackoffice(out erro)) resposta = PedirBackoffice("POST", "/api/bilhete", out erro);
                string mensagem = erro;
                try { BeginInvoke(new Action(() =>
                {
                    abrindoGestao = false; AtualizarEstado();
                    object bilhete;
                    if (resposta == null || !resposta.TryGetValue("bilhete", out bilhete)) { Escrever("Não foi possível abrir a gestão: " + (mensagem ?? "resposta inesperada"), 1); return; }
                    string url = "http://127.0.0.1:" + portaBackoffice + "/#bilhete=" + Uri.EscapeDataString(Convert.ToString(bilhete));
                    string[] browsers = {
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe") };
                    foreach (string exe in browsers)
                        if (File.Exists(exe)) { try { Process.Start(exe, "--app=\"" + url + "\" --window-size=1360,880"); return; } catch { } }
                    try { Process.Start(url); } catch { Escrever("Não foi possível abrir o browser do painel de gestão.", 1); }
                })); } catch { }
            });
        }

        // git pull na pasta do repositório; se houver versão nova e o servidor estiver ligado, propõe reiniciar
        void AtualizarCodigo()
        {
            bAtualizar.Enabled = false; Escrever("A procurar uma versão nova do código no GitHub…", 2);
            ThreadPool.QueueUserWorkItem(_ =>
            {
                string antes = Git("rev-parse --short HEAD").Trim(), saida = Git("pull --ff-only origin master"), depois = Git("rev-parse --short HEAD").Trim();
                try
                {
                    BeginInvoke(new Action(() =>
                    {
                        bAtualizar.Enabled = true;
                        foreach (string l in saida.Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries)) Escrever("[git] " + l.TrimEnd('\r'), 0);
                        if (antes.Length == 0 || antes.StartsWith("fatal") || antes.StartsWith("Git ")) { Escrever("Não foi possível usar o git: " + antes, 1); return; }
                        if (antes == depois) { Escrever("O código já está na versão mais recente (" + depois + ").", 2); return; }
                        Escrever("Código atualizado: " + antes + " → " + depois + ".", 2);
                        string fonte = Path.Combine(raiz, "gestor", "BXBGestor.cs");
                        if (File.Exists(fonte) && File.GetLastWriteTimeUtc(fonte) > File.GetLastWriteTimeUtc(Application.ExecutablePath))
                            Escrever("Há uma versão nova do próprio Gestor: feche-o (Sair) e corra gestor\\compilar.bat.", 2);
                        if (MessageBox.Show(this, "Há uma versão nova do código.\n\nReiniciar os serviços para a usar?", "dinmeta Gestor", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                            Reiniciar(Ligado || Nosso);
                    }));
                }
                catch { }
            });
        }
        string Git(string args)
        {
            try
            {
                var psi = new ProcessStartInfo("git", args) { WorkingDirectory = raiz, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 };
                using (var p = Process.Start(psi))
                {
                    var err = p.StandardError.ReadToEndAsync(); string o = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(120000); return o + err.Result;
                }
            }
            catch (Win32Exception) { return "Git não encontrado. Instale o Git para Windows."; }
            catch (Exception x) { return x.Message; }
        }

        /* ---------------- definições ---------------- */
        void LerIni()
        {
            try { foreach (string l in File.ReadAllLines(ficheiroIni)) { int i = l.IndexOf('='); if (i > 0) ini[l.Substring(0, i).Trim()] = l.Substring(i + 1).Trim(); } } catch { }
        }
        string Ini(string k, string def) { string v; return ini.TryGetValue(k, out v) ? v : def; }
        void GravarIni(string k, string v)
        {
            ini[k] = v; if (captura != null) return;
            try { Directory.CreateDirectory(dados); var l = new List<string>(); foreach (var e in ini) l.Add(e.Key + "=" + e.Value); File.WriteAllLines(ficheiroIni, l.ToArray()); } catch { }
        }
        const string CHAVE_RUN = @"Software\Microsoft\Windows\CurrentVersion\Run";
        bool ArrancaComWindows()
        {
            if (modoTeste) return false;
            try { using (var k = Registry.CurrentUser.OpenSubKey(CHAVE_RUN)) return k != null && k.GetValue("BXB Gestor") != null; } catch { return false; }
        }
        void DefinirArranque(bool sim)
        {
            if (captura != null || modoTeste) return;
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(CHAVE_RUN, true))
                {
                    if (sim) k.SetValue("BXB Gestor", "\"" + Application.ExecutablePath + "\" --bandeja"); else k.DeleteValue("BXB Gestor", false);
                }
                Escrever(sim ? "O dinmeta Gestor passa a abrir com o Windows (na bandeja)." : "O dinmeta Gestor deixa de abrir com o Windows.", 2);
            }
            catch (Exception x) { Escrever("Não foi possível alterar o arranque com o Windows: " + x.Message, 1); }
        }

        /* ---------------- janela e bandeja ---------------- */
        protected override void SetVisibleCore(bool value)
        {
            // aberto com o Windows: começa escondido na bandeja
            if (comecarNaBandeja && !IsHandleCreated) { CreateHandle(); value = false; }
            base.SetVisibleCore(value);
        }
        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try { int sim = 1; if (DwmSetWindowAttribute(Handle, 20, ref sim, 4) != 0) DwmSetWindowAttribute(Handle, 19, ref sim, 4); } catch { }
            // CreateGraphics pode criar o handle antes de a janela acabar de ser construída.
        }
        bool acompanhamentoIniciado;
        void IniciarAcompanhamento()
        {
            if (captura != null || acompanhamentoIniciado) return;
            acompanhamentoIniciado = true;
            relogio = new System.Windows.Forms.Timer { Interval = 2000 }; relogio.Tick += (s, a) => Verificar(); relogio.Start();
            relogioRede = new System.Windows.Forms.Timer { Interval = 3000 }; relogioRede.Tick += (s, a) => { if (Visible && tRede.Visible) LerRede(); }; relogioRede.Start();
            VigiarBackoffice();
            // ao abrir: vê se já está ligado; se não estiver e a opção estiver marcada, liga
            ThreadPool.QueueUserWorkItem(_ =>
            {
                var s = LerSaude();
                try { BeginInvoke(new Action(() => { Aplicar(s); if (s == null && cLigar.Checked) Ligar(); })); } catch { }
            });
        }
        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (captura == null) return;
            // modo de captura (verificação do desenho): preenche com exemplos, grava um PNG e sai
            estado = Estado.Ligado;
            saude = new Saude { Pid = 16516, Arranque = DateTimeOffset.Now.AddMinutes(-73).ToUnixTimeMilliseconds(), Versao = "168173c" };
            saude.Enderecos.Add(new KeyValuePair<string, string>("Site neste computador", "http://localhost/"));
            saude.Enderecos.Add(new KeyValuePair<string, string>("Painel de gestão", "http://127.0.0.1:8100/"));
            AtualizarEstado();
            Escrever("A ligar o servidor (node servidor.js)…", 2); Escrever("", 0); Escrever("  dinmeta - site a correr", 0); Escrever("  Abra: http://localhost/", 0);
            Escrever("  Dados guardados em: C:\\...\\DADOS-SERVIDOR", 0); Escrever("  Rede de casa (telemovel, outros computadores):", 0); Escrever("    https://192.168.1.64:8443/SISTEMAS/index.html", 0);
            Escrever("  Painel de gestao: http://127.0.0.1:8100/ (so neste computador)", 0); Escrever("Servidor ligado.", 2); Escrever("  [email] boas-vindas para x@exemplo.pt: O servidor recusou o utilizador ou a palavra-passe", 1);
            var t = new System.Windows.Forms.Timer { Interval = 900 };
            t.Tick += (s, a) =>
            {
                t.Stop();
                using (var bmp = new Bitmap(Width, Height))
                {
                    using (var g = Graphics.FromImage(bmp)) { IntPtr hdc = g.GetHdc(); PrintWindow(Handle, hdc, 2); g.ReleaseHdc(hdc); }
                    bmp.Save(captura, ImageFormat.Png);
                }
                aSair = true; Close();
            };
            t.Start();
        }
        void Mostrar() { Show(); if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal; Activate(); BringToFront(); }
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!aSair && captura == null && e.CloseReason == CloseReason.UserClosing && cBandeja.Checked)
            {
                e.Cancel = true; Hide();
                if (!avisouBandeja) { avisouBandeja = true; bandeja.ShowBalloonTip(4000, "dinmeta Gestor", "Continua aberto aqui na bandeja. O servidor " + (Ligado ? "continua ligado." : "está desligado."), ToolTipIcon.Info); }
                return;
            }
            if (!aSair && captura == null && e.CloseReason == CloseReason.UserClosing && Nosso)
            {
                if (MessageBox.Show(this, "Sair do dinmeta Gestor desliga o servidor. Continuar?", "dinmeta Gestor", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) { e.Cancel = true; return; }
                e.Cancel = true; Desligar(() => { aSair = true; Close(); }); return;
            }
            // fecho do Windows: desliga depressa
            if (Nosso) { string erro; Pedir("POST", "/v1/desligar", out erro); try { if (!proc.WaitForExit(3000)) proc.Kill(); } catch { } }
            if (captura == null) PararBackoffice();
            base.OnFormClosing(e);
        }
        void Sair()
        {
            if (Nosso && Ligado)
            {
                Mostrar();
                if (MessageBox.Show(this, "Sair do dinmeta Gestor desliga o servidor. Continuar?", "dinmeta Gestor", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return;
                Desligar(() => { aSair = true; Close(); }); return;
            }
            aSair = true; Close();
        }
        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            if (relogio != null) relogio.Dispose();
            if (relogioRede != null) relogioRede.Dispose();
            if (bandeja != null) { bandeja.Visible = false; bandeja.Dispose(); }
            if (iconeAtual != IntPtr.Zero) DestroyIcon(iconeAtual);
            base.OnFormClosed(e);
        }
    }

    class DoubleBufferedPanel : Panel
    {
        public DoubleBufferedPanel() { SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true); }
    }
}
