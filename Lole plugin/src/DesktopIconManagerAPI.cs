namespace Loupedeck.LolePlugin
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Runtime.InteropServices;
    using System.Text;

    public class DesktopItem
    {
        public int Index { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public string Extension { get; set; }
    }

    public static class DesktopIconManager
    {
        #region Native Constants & Structs
        private const uint LVM_FIRST = 0x1000;
        private const uint LVM_GETITEMCOUNT = LVM_FIRST + 4;
        private const uint LVM_GETITEMTEXTW = LVM_FIRST + 115;
        private const uint LVM_SETITEMPOSITION = LVM_FIRST + 15;
        private const uint LVM_GETITEMPOSITION = LVM_FIRST + 16;
        private const uint LVM_GETITEMSPACING = LVM_FIRST + 51;
        private const int GWL_STYLE = -16;
        private const uint LVS_AUTOARRANGE = 0x0100;
        private const uint PROCESS_ALL_ACCESS = 0x0008 | 0x0010 | 0x0020;
        private const uint MEM_COMMIT = 0x1000;
        private const uint MEM_RELEASE = 0x8000;
        private const uint PAGE_READWRITE = 4;

        [StructLayout(LayoutKind.Sequential)]
        public struct LVITEM { public uint mask; public int iItem; public int iSubItem; public uint state; public uint stateMask; public IntPtr pszText; public int cchTextMax; public int iImage; public IntPtr lParam; }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X; public int Y; }
        #endregion

        #region Imports
        [DllImport("user32.dll")] private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
        [DllImport("user32.dll")] private static extern IntPtr FindWindowEx(IntPtr h1, IntPtr h2, string c, string w);
        [DllImport("user32.dll")] private static extern int SendMessage(IntPtr hWnd, uint Msg, int wParam, IntPtr lParam);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll")] private static extern int GetSystemMetrics(int nIndex);
        [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(uint dwAccess, bool bInherit, uint dwId);
        [DllImport("kernel32.dll")] private static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr lpAddress, uint dwSize, uint flType, uint flProtect);
        [DllImport("kernel32.dll")] private static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBase, [Out] byte[] lpBuffer, int dwSize, out int lpRead);
        [DllImport("kernel32.dll")] private static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBase, ref LVITEM lpBuffer, int nSize, out int lpWrite);
        [DllImport("kernel32.dll")] private static extern bool VirtualFreeEx(IntPtr hProcess, IntPtr lpAddress, uint dwSize, uint dwFreeType);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr hObject);
        #endregion

        private static IntPtr MakeLParam(int x, int y) => (IntPtr)((y << 16) | (x & 0xFFFF));

        public static bool IsAutoArrangeEnabled(IntPtr handle)
        {
            return (GetWindowLong(handle, GWL_STYLE) & LVS_AUTOARRANGE) != 0;
        }

        private static Dictionary<string, POINT> _savedLayout = new Dictionary<string, POINT>();
        private static bool _isBaselineSaved = false;

        public static IntPtr GetDesktopListViewHandle()
        {
            IntPtr progman = FindWindow("Progman", "Program Manager");
            IntPtr shell = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            IntPtr lv = FindWindowEx(shell, IntPtr.Zero, "SysListView32", null);

            if (lv == IntPtr.Zero)
            {
                IntPtr workerW = IntPtr.Zero;
                while ((workerW = FindWindowEx(IntPtr.Zero, workerW, "WorkerW", null)) != IntPtr.Zero)
                {
                    shell = FindWindowEx(workerW, IntPtr.Zero, "SHELLDLL_DefView", null);
                    if (shell != IntPtr.Zero)
                        return FindWindowEx(shell, IntPtr.Zero, "SysListView32", null);
                }
            }
            return lv;
        }

        public static List<DesktopItem> GetDesktopIcons(IntPtr handle)
        {
            var icons = new List<DesktopItem>();
            int count = SendMessage(handle, LVM_GETITEMCOUNT, 0, IntPtr.Zero);
            GetWindowThreadProcessId(handle, out uint pid);
            IntPtr hProc = OpenProcess(PROCESS_ALL_ACCESS, false, pid);

            if (hProc == IntPtr.Zero)
                return icons;

            IntPtr rStruct = VirtualAllocEx(hProc, IntPtr.Zero, (uint)Marshal.SizeOf<LVITEM>(), MEM_COMMIT, PAGE_READWRITE);
            IntPtr rText = VirtualAllocEx(hProc, IntPtr.Zero, 512, MEM_COMMIT, PAGE_READWRITE);

            try
            {
                for (int i = 0; i < count; i++)
                {
                    LVITEM item = new LVITEM { mask = 1, iItem = i, pszText = rText, cchTextMax = 256 };
                    WriteProcessMemory(hProc, rStruct, ref item, Marshal.SizeOf<LVITEM>(), out _);
                    SendMessage(handle, LVM_GETITEMTEXTW, i, rStruct);

                    byte[] nameBuf = new byte[512];
                    ReadProcessMemory(hProc, rText, nameBuf, nameBuf.Length, out _);
                    string name = Encoding.Unicode.GetString(nameBuf).Split('\0')[0];

                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        string path = IconTypeChecker.FindPath(name);
                        string type = path == null ? "system" : (File.GetAttributes(path).HasFlag(FileAttributes.Directory) ? "folder" : "file");
                        string ext = path == null ? "" : Path.GetExtension(path).ToLower();

                        icons.Add(new DesktopItem { Index = i, Name = name, Type = type, Extension = ext });
                    }
                }
            }
            finally
            {
                VirtualFreeEx(hProc, rStruct, 0, MEM_RELEASE);
                VirtualFreeEx(hProc, rText, 0, MEM_RELEASE);
                CloseHandle(hProc);
            }
            return icons;
        }

        public static void SaveCurrentLayout(IntPtr handle)
        {
            _savedLayout.Clear();
            int count = SendMessage(handle, LVM_GETITEMCOUNT, 0, IntPtr.Zero);
            GetWindowThreadProcessId(handle, out uint pid);
            IntPtr hProc = OpenProcess(PROCESS_ALL_ACCESS, false, pid);

            if (hProc == IntPtr.Zero)
                return;

            IntPtr rStruct = VirtualAllocEx(hProc, IntPtr.Zero, (uint)Marshal.SizeOf<LVITEM>(), MEM_COMMIT, PAGE_READWRITE);
            IntPtr rText = VirtualAllocEx(hProc, IntPtr.Zero, 512, MEM_COMMIT, PAGE_READWRITE);
            IntPtr rPoint = VirtualAllocEx(hProc, IntPtr.Zero, (uint)Marshal.SizeOf<POINT>(), MEM_COMMIT, PAGE_READWRITE);

            try
            {
                for (int i = 0; i < count; i++)
                {
                    LVITEM item = new LVITEM { mask = 1, iItem = i, pszText = rText, cchTextMax = 256 };
                    WriteProcessMemory(hProc, rStruct, ref item, Marshal.SizeOf<LVITEM>(), out _);
                    SendMessage(handle, LVM_GETITEMTEXTW, i, rStruct);
                    byte[] nameBuf = new byte[512];
                    ReadProcessMemory(hProc, rText, nameBuf, nameBuf.Length, out _);
                    string name = Encoding.Unicode.GetString(nameBuf).Split('\0')[0];

                    SendMessage(handle, LVM_GETITEMPOSITION, i, rPoint);
                    byte[] ptBuf = new byte[Marshal.SizeOf<POINT>()];
                    ReadProcessMemory(hProc, rPoint, ptBuf, ptBuf.Length, out _);
                    POINT pt = MemoryMarshal.Cast<byte, POINT>(ptBuf)[0];

                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        _savedLayout[name] = pt;
                    }
                }
            }
            finally
            {
                VirtualFreeEx(hProc, rStruct, 0, MEM_RELEASE);
                VirtualFreeEx(hProc, rText, 0, MEM_RELEASE);
                VirtualFreeEx(hProc, rPoint, 0, MEM_RELEASE);
                CloseHandle(hProc);

                if (_savedLayout.Count > 0)
                {
                    _isBaselineSaved = true;
                }
            }
        }

        public static void ArrangeIcons(IntPtr handle)
        {
            if (handle == IntPtr.Zero)
            {
                NotificationHelper.ShowToast("Desktop Error", "Could not locate the Windows Desktop layer.");
                return;
            }

            if (IsAutoArrangeEnabled(handle))
            {
                NotificationHelper.ShowToast("Layout Blocked", "Please right-click the desktop -> View -> uncheck 'Auto arrange icons'.");
                return;
            } 

            if (!_isBaselineSaved)
            {
                SaveCurrentLayout(handle);
            }

            var icons = GetDesktopIcons(handle);
            if (icons == null || icons.Count == 0)
                return;

            var folders = new List<DesktopItem>();
            var pdfFiles = new List<DesktopItem>();
            var txtAndDocs = new List<DesktopItem>();
            var others = new List<DesktopItem>();

            foreach (var icon in icons)
            {
                if (icon.Type == "folder")
                    folders.Add(icon);
                else if (icon.Type == "file" && icon.Extension == ".pdf")
                    pdfFiles.Add(icon);
                else if (icon.Type == "file" && (icon.Extension == ".txt" || icon.Extension == ".doc" || icon.Extension == ".docx"))
                    txtAndDocs.Add(icon);
                else
                    others.Add(icon);
            }

            int screenW = GetSystemMetrics(0);
            int screenH = GetSystemMetrics(1) - 40;

            int spacingRaw = SendMessage(handle, LVM_GETITEMSPACING, 0, IntPtr.Zero);
            int spacingX = spacingRaw & 0xFFFF;
            int spacingY = (spacingRaw >> 16) & 0xFFFF;

            if (spacingX < 50)
                spacingX = 85;
            if (spacingY < 50)
                spacingY = 85;

            int leftMargin = 20;
            int rightMargin = 5;
            int topMargin = 20;
            int bottomMargin = 20;

            int maxRowsPerQuadrant = (screenH / 2) / spacingY;
            if (maxRowsPerQuadrant < 1)
                maxRowsPerQuadrant = 1;

            var targetPositions = new Dictionary<int, POINT>();

            // ==========================================
            // FIX: DYNAMIC VISUAL UI BALANCER
            // ==========================================

            // 1. Define the 4 corner definitions using Tuples
            var corners = new (int startX, int startY, int wrapDirX, int fillDirY)[]
            {
                (leftMargin, topMargin, 1, 1),                                                                // Default: Top-Left
                (screenW - rightMargin - spacingX, topMargin, -1, 1),                                         // Default: Top-Right
                (leftMargin, screenH - bottomMargin - spacingY, 1, -1),                                       // Default: Bottom-Left
                (screenW - rightMargin - spacingX, screenH - bottomMargin - spacingY, -1, -1)                 // Default: Bottom-Right
            };

            // 2. Put our islands into an array matching the default corner indexes
            var islands = new List<DesktopItem>[] { folders, pdfFiles, txtAndDocs, others };

            // 3. Find the indexes of the most and least populated islands
            int maxIndex = 0;
            int minIndex = 0;
            for (int i = 1; i < islands.Length; i++)
            {
                if (islands[i].Count > islands[maxIndex].Count)
                    maxIndex = i;
                if (islands[i].Count < islands[minIndex].Count)
                    minIndex = i;
            }

            // 4. Swap their designated corners to balance the UI weight perfectly!
            var tempCorner = corners[maxIndex];
            corners[maxIndex] = corners[minIndex];
            corners[minIndex] = tempCorner;

            void MapQuadrant(List<DesktopItem> island, int startX, int startY, int wrapDirX, int fillDirY)
            {
                if (island.Count == 0)
                    return;

                int currentX = startX;
                int currentY = startY;

                for (int j = 0; j < island.Count; j++)
                {
                    targetPositions[island[j].Index] = new POINT { X = currentX, Y = currentY };

                    if ((j + 1) % maxRowsPerQuadrant == 0)
                    {
                        currentY = startY;
                        currentX += (spacingX * wrapDirX);
                    }
                    else
                    {
                        currentY += (spacingY * fillDirY);
                    }
                }
            }

            // 5. Build the target map using our freshly sorted visual layout
            for (int i = 0; i < islands.Length; i++)
            {
                MapQuadrant(islands[i], corners[i].startX, corners[i].startY, corners[i].wrapDirX, corners[i].fillDirY);
            }

            // The Anti-Deadlock Bulldozer
            System.Threading.Tasks.Task.Run(async () =>
            {
                var forwardList = targetPositions.ToList();
                var backwardList = forwardList.AsEnumerable().Reverse().ToList();

                for (int pass = 0; pass < 8; pass++)
                {
                    var currentList = (pass % 2 == 0) ? forwardList : backwardList;

                    foreach (var kvp in currentList)
                    {
                        SendMessage(handle, LVM_SETITEMPOSITION, kvp.Key, MakeLParam(kvp.Value.X, kvp.Value.Y));
                    }
                    await System.Threading.Tasks.Task.Delay(100);
                }
            });
        }

        public static void RestoreLayout(IntPtr handle)
        {
            if (!_isBaselineSaved || IsAutoArrangeEnabled(handle))
                return;

            var icons = GetDesktopIcons(handle);
            var targetPositions = new Dictionary<int, POINT>();

            foreach (var icon in icons)
            {
                if (_savedLayout.TryGetValue(icon.Name, out POINT pt))
                {
                    targetPositions[icon.Index] = pt;
                }
            }

            System.Threading.Tasks.Task.Run(async () =>
            {
                var forwardList = targetPositions.ToList();
                var backwardList = forwardList.AsEnumerable().Reverse().ToList();

                for (int pass = 0; pass < 8; pass++)
                {
                    var currentList = (pass % 2 == 0) ? forwardList : backwardList;

                    foreach (var kvp in currentList)
                    {
                        SendMessage(handle, LVM_SETITEMPOSITION, kvp.Key, MakeLParam(kvp.Value.X, kvp.Value.Y));
                    }
                    await System.Threading.Tasks.Task.Delay(100);
                }
            });

            _savedLayout.Clear();
            _isBaselineSaved = false;
        }
    }

    public static class IconTypeChecker
    {
        public static string FindPath(string name)
        {
            string[] bases = { Environment.GetFolderPath(Environment.SpecialFolder.Desktop), Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory) };
            foreach (var b in bases)
            {
                string p = Path.Combine(b, name);
                if (Directory.Exists(p) || File.Exists(p))
                    return p;
                if (File.Exists(p + ".lnk"))
                    return p + ".lnk";
                try
                {
                    var matches = Directory.GetFiles(b, name + ".*");
                    if (matches.Length > 0)
                        return matches[0];
                }
                catch { }
            }
            return null;
        }
    }
}