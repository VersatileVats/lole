using System;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Net.WebSockets;
using System.Threading.Tasks;

using System.IO;
using System.Collections.Generic;

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Net.Sockets;

// to download the lplug4 file from the server
using System.Net.Http;
using Microsoft.Win32;

using Loupedeck.LolePlugin;

public class ExtensionMessage
{
    public string type { get; set; }
    public string email { get; set; }
    public string payload { get; set; }
    public string profilePath { get; set; }
}

public class ChromeMailInfo
{
    public string mailName { get; set; }
    public string pictureUrl { get; set; }
    public string mailAddress { get; set; }
}

public class ChromeProfileInfo
{
    public string profileName { get; set; }
    public string profilePath { get; set; }
    public List<ChromeMailInfo> mails { get; set; } = new List<ChromeMailInfo>();
}

public class CleanResult
{
    public int FilesDeleted { get; set; }
    public int FoldersDeleted { get; set; }
    public long BytesFreed { get; set; }
    public string FormattedSize { get; set; }
    public string Summary { get; set; }
}

public class ToolRenameResult
{
    public bool success { get; set; }
    public string message { get; set; }
    public string oldName { get; set; }
    public string newName { get; set; }
    public string filePath { get; set; }
}


// To fetch the gmail profiles & email accounts
public static class ChromeAccountAPI
{
    private static string UserDataPath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\User Data");

    public static List<ChromeProfileInfo> GetProfiles()
    {
        var profiles = new List<ChromeProfileInfo>();

        if (!Directory.Exists(UserDataPath))
            return profiles;

        foreach (string profilePath in Directory.GetDirectories(UserDataPath, "*"))
        {
            string folderName = Path.GetFileName(profilePath);
            if (folderName == "Default" || folderName.StartsWith("Profile"))
            {
                string prefsPath = Path.Combine(profilePath, "Preferences");
                if (File.Exists(prefsPath))
                {
                    // Pass the full profilePath down so we can include it in the JSON
                    var info = ExtractAccountInfo(prefsPath, folderName, profilePath);
                    if (info != null)
                        profiles.Add(info);
                }
            }
        }
        return profiles;
    }

    private static ChromeProfileInfo ExtractAccountInfo(string filePath, string folderName, string fullPath)
    {
        var profileInfo = new ChromeProfileInfo
        {
            profileName = folderName,
            profilePath = fullPath
        };

        try
        {
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            byte[] buffer = new byte[51200];
            int bytesRead = fs.Read(buffer, 0, buffer.Length);

            var reader = new Utf8JsonReader(buffer.AsSpan(0, bytesRead), new JsonReaderOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip });

            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.PropertyName && reader.GetString() == "account_info")
                {
                    if (reader.Read() && reader.TokenType == JsonTokenType.StartArray)
                    {
                        using var doc = JsonDocument.ParseValue(ref reader);

                        // Loop through ALL accounts and add them to the list
                        foreach (var account in doc.RootElement.EnumerateArray())
                        {
                            string name = account.TryGetProperty("full_name", out var n) ? n.GetString() ?? "N/A" : "N/A";
                            string email = account.TryGetProperty("email", out var e) ? e.GetString() ?? "N/A" : "N/A";

                            // Extract the picture URL
                            string picture = account.TryGetProperty("picture_url", out var p) ? p.GetString() ?? "" : "";

                            profileInfo.mails.Add(new ChromeMailInfo
                            {
                                mailName = name,
                                mailAddress = email,
                                pictureUrl = picture
                            });
                        }

                        // Return the profile only AFTER the loop is totally finished
                        return profileInfo;
                    }
                }
            }
        }
        catch { /* Ignore read errors for active files */ }

        // Fallback: If the folder exists but has no Google accounts synced
        if (profileInfo.mails.Count == 0)
        {
            profileInfo.mails.Add(new ChromeMailInfo
            {
                mailName = "Local Profile",
                mailAddress = "N/A",
                pictureUrl = "" // Return empty string to prevent null reference errors in Chrome
            });
        }

        return profileInfo;
    }

    public static void LaunchProfile(string profilePathOrName)
    {
        // Extract just the folder name (e.g., "Profile 2" or "Default")
        string profileFolderName = Path.GetFileName(profilePathOrName);

        // 1. Locate the executable in standard locations
        string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
        if (!File.Exists(chromePath))
            chromePath = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";

        // 2. Only pass the profile-directory.
        // This forces Chrome to respect the targeted profile even if another instance is running.
        string args = $"--profile-directory=\"{profileFolderName}\"";

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = chromePath,
                Arguments = args,
                UseShellExecute = true
            });
            Console.WriteLine($"Successfully sent launch command for: {profileFolderName}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to launch Chrome: {ex.Message}");
        }
    }
}

public static class SystemCleanerAPI
{
    public static CleanResult ExecuteDeepClean()
    {
        string[] targets = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Recent"),
            Path.Combine(Environment.GetEnvironmentVariable("windir") ?? "C:\\Windows", "Temp"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp")
        };

        int totalDeletedFiles = 0;
        int totalDeletedDirs = 0;
        long totalFreedBytes = 0;

        foreach (var path in targets)
        {
            if (!Directory.Exists(path))
                continue;

            try
            {
                string[] files = Directory.GetFiles(path);
                foreach (var f in files)
                {
                    try
                    {
                        long fileSize = new FileInfo(f).Length;
                        File.Delete(f);
                        totalFreedBytes += fileSize;
                        totalDeletedFiles++;
                    }
                    catch { /* Ignore files in use */ }
                }

                string[] dirs = Directory.GetDirectories(path);
                foreach (var d in dirs)
                {
                    try
                    { Directory.Delete(d, true); totalDeletedDirs++; }
                    catch { /* Ignore protected dirs */ }
                }
            }
            catch (UnauthorizedAccessException)
            {
                // We don't have Admin rights to read this specific folder. Skip it.
                System.Diagnostics.Debug.WriteLine($"Access Denied to read: {path}");
            }
            catch (Exception)
            {
                // Catch any other weird OS errors and keep going
            }
        }

        string sizeStr = FormatBytes(totalFreedBytes);

        return new CleanResult
        {
            FilesDeleted = totalDeletedFiles,
            FoldersDeleted = totalDeletedDirs,
            BytesFreed = totalFreedBytes,
            FormattedSize = sizeStr,
            Summary = $"Temporary stuff deleted: {totalDeletedFiles} files ({sizeStr}) and {totalDeletedDirs} folders deleted."
        };
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes == 0)
            return "0 B";
        string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
        int counter = 0;
        decimal number = (decimal)bytes;

        while (Math.Round(number / 1024) >= 1 && counter < suffixes.Length - 1)
        {
            number /= 1024;
            counter++;
        }
        return string.Format("{0:n2} {1}", number, suffixes[counter]);
    }
}

// Look out for the Chrome instance
public static class ChromeWindowManagerAPI
{
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    private const int SW_RESTORE = 9;
    private const byte VK_MENU = 0x12;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const byte VK_CONTROL = 0x11;
    private const byte VK_SHIFT = 0x10;
    private const byte VK_ESCAPE = 0x1B;

    // for the dial adjustment & buttons
    public const byte VK_TAB = 0x09;
    public const byte VK_F5 = 0x74;
    public const byte VK_F12 = 0x7B;

    public static void ShowDesktop()
    {
        // Fire Win + M (Minimize All) and it won't toggle windows back up
        keybd_event(VK_LWIN, 0, 0, 0);
        keybd_event(0x4D, 0, 0, 0); // 0x4D is the 'M' key
        keybd_event(0x4D, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);

        // Maintain the sleep to allow the Windows animation to complete
        System.Threading.Thread.Sleep(300);
    }

    public static void SendShortcut(byte vkKey, bool ctrl = false, bool shift = false, bool alt = false)
    {
        if (ctrl)
            keybd_event(VK_CONTROL, 0, 0, 0);
        if (shift)
            keybd_event(VK_SHIFT, 0, 0, 0);
        if (alt)
            keybd_event(VK_MENU, 0, 0, 0);

        keybd_event(vkKey, 0, 0, 0);
        keybd_event(vkKey, 0, KEYEVENTF_KEYUP, 0);

        if (alt)
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
        if (shift)
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);
        if (ctrl)
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }

    public static void SwitchTab(bool reverse)
    {
        keybd_event(VK_CONTROL, 0, 0, 0);

        if (reverse)
            keybd_event(VK_SHIFT, 0, 0, 0);

        keybd_event(VK_TAB, 0, 0, 0);
        keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, 0);

        if (reverse)
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);

        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }

    public static bool TryFocusProfileNatively(string profilePath)
    {
        try
        {
            // 1. Quick exit if Chrome isn't even running
            if (Process.GetProcessesByName("chrome").Length == 0)
                return false;

            // Extract the folder name only (e.g., "Profile 2" or "Default")
            // This perfectly matches Chrome's actual command line arguments.
            string profileFolderName = Path.GetFileName(profilePath);

            // Build the WMI filter cleanly using the extracted folder name
            string wmiFilter = $"Name='chrome.exe' AND CommandLine LIKE '%{profileFolderName}%'";
            string psCommand = $"(Get-CimInstance Win32_Process -Filter \\\"{wmiFilter}\\\").ProcessId";

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -NonInteractive -Command \"{psCommand}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using (Process ps = Process.Start(psi))
            {
                string output = ps.StandardOutput.ReadToEnd();
                ps.WaitForExit();

                // 3. Parse the returned PIDs
                string[] pids = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

                foreach (string pidStr in pids)
                {
                    if (int.TryParse(pidStr.Trim(), out int pid))
                    {
                        Process process = Process.GetProcessById(pid);

                        // 4. Focus the exact process that owns the active window!
                        if (process.MainWindowHandle != IntPtr.Zero)
                        {
                            ShowWindow(process.MainWindowHandle, SW_RESTORE);
                            SetForegroundWindow(process.MainWindowHandle);
                            return true;
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            NotificationHelper.ShowToast("Native focus failed", ex.Message);
        }

        return false;
    }

    public static void SendCtrlShiftShortcut(char key, bool useShift = true)
    {
        byte vkKey = (byte)char.ToUpper(key);

        keybd_event(VK_CONTROL, 0, 0, 0);

        if (useShift)
            keybd_event(VK_SHIFT, 0, 0, 0);

        keybd_event(vkKey, 0, 0, 0);
        keybd_event(vkKey, 0, KEYEVENTF_KEYUP, 0);

        if (useShift)
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);

        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }

    // for toggling the desktop icons
    private const byte VK_LWIN = 0x5B; // Left Windows Key
    private const byte VK_M = 0x4D;    // M Key (Minimize All)

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    public static void ToggleDesktopIcons()
    {
        // 1. Force MINIMIZE ALL (Win + M). This pushes windows down and never brings them back up.
        keybd_event(VK_LWIN, 0, 0, 0);
        keybd_event(VK_M, 0, 0, 0);
        keybd_event(VK_M, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);

        // Give Windows a split-second to run the minimize animation
        System.Threading.Thread.Sleep(100);

        // 2. Try the classic Progman location first
        IntPtr hWnd = FindWindow("Progman", "Program Manager");
        IntPtr hWndDefView = FindWindowEx(hWnd, IntPtr.Zero, "SHELLDLL_DefView", null);

        // 3. If it's not there, hunt it down in the WorkerW layers
        if (hWndDefView == IntPtr.Zero)
        {
            IntPtr hWorkerW = FindWindowEx(IntPtr.Zero, IntPtr.Zero, "WorkerW", null);

            while (hWorkerW != IntPtr.Zero && hWndDefView == IntPtr.Zero)
            {
                hWndDefView = FindWindowEx(hWorkerW, IntPtr.Zero, "SHELLDLL_DefView", null);
                hWorkerW = FindWindowEx(IntPtr.Zero, hWorkerW, "WorkerW", null);
            }
        }

        // 4. Send the toggle command directly to the icon container
        if (hWndDefView != IntPtr.Zero)
        {
            SendMessage(hWndDefView, 0x0111 /* WM_COMMAND */, new IntPtr(0x7402), IntPtr.Zero);
        }
    }
}

// logiPluginTool API
public static class LogiPluginToolAPI
{
    private static string ToolsPath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".dotnet", "tools");

    public static ToolRenameResult RenameTool()
    {
        // 1. Check if the directory exists
        if (!Directory.Exists(ToolsPath))
            return new ToolRenameResult { success = false, message = "Tools directory not found." };

        // 2. Check for an .exe file
        string[] exeFiles = Directory.GetFiles(ToolsPath, "*.exe");
        if (exeFiles.Length == 0)
            return new ToolRenameResult { success = false, message = "No .exe file found in tools directory." };

        // Grab the first executable found
        string oldPath = exeFiles[0];
        string oldName = Path.GetFileName(oldPath);

        // 3. Determine the new name (The Toggle Logic)
        string newName = oldName.Equals("LogiPluginTool.exe", StringComparison.OrdinalIgnoreCase)
            ? "logi.exe"
            : "LogiPluginTool.exe";

        string newPath = Path.Combine(ToolsPath, newName);

        try
        {
            if (File.Exists(newPath))
                File.Delete(newPath);
            File.Move(oldPath, newPath);

            // 1. Get the name without extension (e.g., "logi")
            string nameWithoutExe = Path.GetFileNameWithoutExtension(newName);

            // 2. Combine it with the ToolsPath to get the full absolute path
            string absolutePathWithoutExe = Path.Combine(ToolsPath, nameWithoutExe);

            return new ToolRenameResult
            {
                success = true,
                message = $"{Path.GetFileNameWithoutExtension(oldName)} exe renamed to {Path.GetFileNameWithoutExtension(newName)}. For instance, use {Path.GetFileNameWithoutExtension(newName)} generate example",
                oldName = oldName,
                newName = newName,
                filePath = absolutePathWithoutExe // Now returns the full path on disk
            };
        }
        catch (Exception ex)
        {
            return new ToolRenameResult { success = false, message = ex.Message };
        }
    }
}



/** Web server feature **/
public class WebService : IDisposable
{
    private static WebService _instance;
    private static readonly Object _lock = new();
    private HttpListener _listener;
    private WebSocket _socket;
    private Boolean _disposed = false;

    public Int32 Port { get; private set; }
    public Boolean IsRunning { get; private set; }

    public event EventHandler<string> OnServerStartFailed;
    public event EventHandler<string> OnExtensionInstalled;

    public bool IsClientConnected => _socket != null && _socket.State == WebSocketState.Open;

        // 1. Private Constructor (Singleton Rule)
    private WebService()
    {
        Port = 12345; // You can use the FindAvailablePort logic here if needed
    }

    private void ProcessExtensionCommand(ExtensionMessage message)
    {
        if (message == null || string.IsNullOrEmpty(message.type))
            return;

        switch (message.type)
        {
            case "ping":
                if (!string.IsNullOrEmpty(message.email))
                {
                    var allProfiles = ChromeAccountAPI.GetProfiles();

                    // STRICT MATCH: Only check the very first email (the primary account) of each profile
                    var matchingProfile = allProfiles.FirstOrDefault(p =>
                        p.mails.Count > 0 &&
                        p.mails[0].mailAddress.Equals(message.email, StringComparison.OrdinalIgnoreCase));

                    
                    if (matchingProfile != null)
                    {
                        this.OnExtensionInstalled?.Invoke(this, matchingProfile.profilePath);
                    }
                }
                break;

            case "GET_CHROME_PROFILES":
                // 1. Get the data
                var profiles = ChromeAccountAPI.GetProfiles();

                // 2. Package it into an anonymous object
                var profileResponse = new
                {
                    type = "CHROME_PROFILES_RESULT",
                    data = profiles
                };

                // 3. Convert to JSON and send to Chrome
                string profileJson = JsonSerializer.Serialize(profileResponse);
                _ = SendAsync(profileJson);
                break;

            case "RUN_DEEP_CLEAN":
                try
                {
                    CleanResult cleanStats = SystemCleanerAPI.ExecuteDeepClean();
                    NotificationHelper.ShowToast("✅ Deep Clean completed", cleanStats.Summary);
                }
                catch (Exception ex)
                {
                    string errorMessage = string.IsNullOrEmpty(ex.Message)
                        ? "Ran into some issues while calling the Deep Clean method from Logi Plugin"
                        : ex.Message;

                    NotificationHelper.ShowToast("🚫 Errors in doing deep clean", errorMessage);
                }
                break;

            case "OPEN_PROFILE":
                if (!string.IsNullOrEmpty(message.profilePath))
                {
                    // Call it statically from your API class!
                    bool wasFocused = ChromeWindowManagerAPI.TryFocusProfileNatively(message.profilePath);

                    if (!wasFocused)
                    {
                        ChromeAccountAPI.LaunchProfile(message.profilePath);
                    }
                }
                break;
        }
    }

    // 2. The Global Access Point
    public static WebService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new WebService();
                }
            }
            return _instance;
        }
    }

    private static readonly HttpClient _httpClient = new HttpClient();

    public static async Task DownloadFileAsync(string fileUrl, string savePath)
    {
        try

        {
            var response = await _httpClient.GetAsync(fileUrl);
            response.EnsureSuccessStatusCode();

            using (var fs = new FileStream(savePath, FileMode.Create, FileAccess.Write, FileShare.None))
            { await response.Content.CopyToAsync(fs); }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(savePath) { UseShellExecute = true });    
        }
        catch (System.Exception ex)
        {
            NotificationHelper.ShowToast("Profile call failed: ", ex.Message);
        }
    }

    // 3. Start the WebSocket Listener
    public async Task StartAsync()
    {
        if (IsRunning)
            return;

        try
        {
            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://localhost:{Port}/");
            _listener.Start();

            IsRunning = true; // Only mark as running if Start() succeeds!

            // Run listening loop in the background
            _ = Task.Run(async () =>
            {
                while (IsRunning)
                {
                    try
                    {
                        var context = await _listener.GetContextAsync();
                        if (context.Request.IsWebSocketRequest)
                        {
                            var wsContext = await context.AcceptWebSocketAsync(null);
                            _socket = wsContext.WebSocket;
                            _ = ReceiveLoop(); // Start receiving messages
                        }
                    }
                    catch (Exception) { /* Handle listener stopped */ }
                }
            });
        }
        catch (Exception ex)
        {
            // If the port is blocked or it fails to start, fire the event!
            IsRunning = false;
            OnServerStartFailed?.Invoke(this, ex.Message);
        }
    }

    private async Task ReceiveLoop()
    {
        var buffer = new byte[1024 * 4];
        while (_socket != null && _socket.State == WebSocketState.Open)
        {
            var result = await _socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

            if (result.MessageType == WebSocketMessageType.Close)
                break;

            // 1. Convert bytes to string
            var messageString = Encoding.UTF8.GetString(buffer, 0, result.Count);

            try
            {
                // 2. Parse the JSON
                var message = JsonSerializer.Deserialize<ExtensionMessage>(messageString);

                // 3. Send it to a handler
                ProcessExtensionCommand(message);
            }
            catch (JsonException)
            {
                // Ignore badly formatted JSON
            }
        }
    }

    // 4. Send messages to Chrome
    public async Task SendAsync(string message)
    {
        if (_socket?.State == WebSocketState.Open)
        {
            var bytes = Encoding.UTF8.GetBytes(message);
            await _socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }

    // 5. Proper Cleanup
    public void Dispose()
    {
        if (_disposed)
            return;
        IsRunning = false;
        _listener?.Stop();
        _socket?.Dispose();
        _disposed = true;
    }
}