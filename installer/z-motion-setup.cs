using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class SetupProgram
{
    [STAThread]
    private static int Main(string[] arguments)
    {
        if (arguments.Length == 2 && arguments[0] == "/sandbox")
        {
            try { Install(Path.GetFullPath(arguments[1])); return 0; }
            catch (Exception failure)
            {
                Directory.CreateDirectory(arguments[1]);
                File.WriteAllText(Path.Combine(arguments[1], "setup-error.txt"), failure.ToString());
                return 1;
            }
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupWindow());
        return 0;
    }

    internal static string Install(string sandbox)
    {
        string parent = sandbox == null ? Path.GetTempPath() : sandbox;
        Directory.CreateDirectory(parent);
        string folder = Path.GetFullPath(Path.Combine(parent, "z-motion-setup-" + Guid.NewGuid().ToString("N")));
        string checkedParent = Path.GetFullPath(parent).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!folder.StartsWith(checkedParent, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Invalid extraction path.");
        Directory.CreateDirectory(folder);
        try
        {
            string archive = Path.Combine(folder, "payload.zip");
            using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("z-motion-package.zip"))
            using (FileStream target = File.Create(archive))
            {
                if (resource == null) throw new InvalidOperationException("The installer payload is missing.");
                resource.CopyTo(target);
            }
            string extracted = Path.Combine(folder, "package");
            ZipFile.ExtractToDirectory(archive, extracted);
            var start = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell\\v1.0\\powershell.exe"),
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(extracted, "install-z-motion.ps1") + "\"" + (sandbox == null ? " -EnableUnsigned" : " -SandboxRoot \"" + sandbox + "\""),
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using (Process process = Process.Start(start))
            {
                Task<string> output = process.StandardOutput.ReadToEndAsync();
                Task<string> error = process.StandardError.ReadToEndAsync();
                process.WaitForExit();
                if (process.ExitCode != 0) throw new InvalidOperationException(error.Result + Environment.NewLine + output.Result);
                return output.Result;
            }
        }
        finally
        {
            if (Directory.Exists(folder) && Path.GetFullPath(folder).StartsWith(checkedParent, StringComparison.OrdinalIgnoreCase)) Directory.Delete(folder, true);
        }
    }
}

internal sealed class SetupWindow : Form
{
    private readonly Button install;
    private readonly CheckBox consent;
    private readonly TextBox status;
    private readonly ProgressBar progress;
    private bool working;

    internal SetupWindow()
    {
        Text = "Z Motion Setup";
        ClientSize = new Size(580, 450);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(255, 247, 211);
        ForeColor = Color.FromArgb(10, 10, 10);
        Font = new Font("Segoe UI", 10);
        Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
        Controls.Add(new Label { Text = "Z MOTION", Font = new Font("Segoe UI", 28, FontStyle.Bold), Location = new Point(28, 22), Size = new Size(510, 58) });
        Controls.Add(new Label { Text = "Motion tools for Premiere Pro 2026", Location = new Point(30, 84), AutoSize = true });
        Controls.Add(new Label { Text = "Includes the panel, motion engine and Argentum Sans fonts.\nNo Node.js, npm or administrator account is required.\nClose Premiere before installing. Premiere 26.x with CEP 12 is required.", Location = new Point(30, 124), Size = new Size(520, 76) });
        consent = new CheckBox { Text = "Enable unsigned Adobe CEP extensions for my Windows user.\nThis shared Adobe setting is required for this local release.", Location = new Point(30, 205), Size = new Size(520, 54), Checked = true };
        Controls.Add(consent);
        status = new TextBox { ReadOnly = true, Multiline = true, ScrollBars = ScrollBars.Vertical, BackColor = BackColor, BorderStyle = BorderStyle.None, Location = new Point(30, 270), Size = new Size(520, 84), Text = "Installs to your Adobe CEP extensions folder. Existing Z Motion installations are updated. Other extensions are preserved." };
        Controls.Add(status);
        progress = new ProgressBar { Location = new Point(30, 365), Size = new Size(520, 5), Visible = false, Style = ProgressBarStyle.Marquee };
        Controls.Add(progress);
        install = new Button { Text = "INSTALL Z MOTION", Location = new Point(30, 390), Size = new Size(340, 38), BackColor = Color.FromArgb(171, 21, 9), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 10, FontStyle.Bold) };
        install.Click += InstallClicked;
        Controls.Add(install);
        var close = new Button { Text = "Close", Location = new Point(390, 390), Size = new Size(160, 38), FlatStyle = FlatStyle.Flat };
        close.Click += delegate { if (!working) Close(); };
        Controls.Add(close);
        FormClosing += delegate(object sender, FormClosingEventArgs arguments) { if (working) arguments.Cancel = true; };
    }

    private async void InstallClicked(object sender, EventArgs arguments)
    {
        if (!consent.Checked) { status.Text = "Enable the Adobe CEP setting above to install this local release."; return; }
        working = true;
        install.Enabled = false;
        consent.Enabled = false;
        progress.Visible = true;
        status.Text = "Verifying files and installing Z Motion...";
        try
        {
            status.Text = await Task.Run(() => SetupProgram.Install(null));
            install.Text = "INSTALLED";
        }
        catch (Exception failure)
        {
            status.Text = failure.Message;
            install.Enabled = true;
            consent.Enabled = true;
        }
        finally { working = false; progress.Visible = false; }
    }
}
