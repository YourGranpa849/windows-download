param([ValidateSet('get','set','mute')][string]$Action='get',[double]$Volume=50,[bool]$Muted=$false)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
interface IMMDeviceEnumerator { [PreserveSig] int EnumAudioEndpoints(int dataFlow,int stateMask,out IntPtr devices); [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow,int role,out IMMDevice device); }
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("D666063F-1587-4E43-81F1-B948E807363F")]
interface IMMDevice { [PreserveSig] int Activate(ref Guid iid,int clsctx,IntPtr activationParams,[MarshalAs(UnmanagedType.Interface)] out IAudioEndpointVolume volume); }
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
interface IAudioEndpointVolume {
 [PreserveSig] int RegisterControlChangeNotify(IntPtr p); [PreserveSig] int UnregisterControlChangeNotify(IntPtr p); [PreserveSig] int GetChannelCount(out uint count);
 [PreserveSig] int SetMasterVolumeLevel(float level,Guid context); [PreserveSig] int SetMasterVolumeLevelScalar(float level,Guid context); [PreserveSig] int GetMasterVolumeLevel(out float level); [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
 [PreserveSig] int SetChannelVolumeLevel(uint channel,float level,Guid context); [PreserveSig] int SetChannelVolumeLevelScalar(uint channel,float level,Guid context); [PreserveSig] int GetChannelVolumeLevel(uint channel,out float level); [PreserveSig] int GetChannelVolumeLevelScalar(uint channel,out float level);
 [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute,Guid context); [PreserveSig] int GetMute(out bool mute);
 [PreserveSig] int GetVolumeStepInfo(out uint step,out uint stepCount); [PreserveSig] int VolumeStepUp(Guid context); [PreserveSig] int VolumeStepDown(Guid context); [PreserveSig] int QueryHardwareSupport(out uint mask); [PreserveSig] int GetVolumeRange(out float min,out float max,out float increment);
}
public static class HTSystemVolume {
 static IAudioEndpointVolume Get(){ var e=(IMMDeviceEnumerator)new MMDeviceEnumerator(); IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0,1,out d)); Guid id=typeof(IAudioEndpointVolume).GUID; IAudioEndpointVolume v; Marshal.ThrowExceptionForHR(d.Activate(ref id,23,IntPtr.Zero,out v)); return v; }
 public static object Read(){var v=Get();float level;bool mute;Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out level));Marshal.ThrowExceptionForHR(v.GetMute(out mute));return new { volume=(int)Math.Round(level*100), muted=mute };}
 public static object Write(double level){var v=Get();level=Math.Max(0,Math.Min(100,level));Marshal.ThrowExceptionForHR(v.SetMasterVolumeLevelScalar((float)(level/100),Guid.Empty));return Read();}
 public static object Mute(bool muted){var v=Get();Marshal.ThrowExceptionForHR(v.SetMute(muted,Guid.Empty));return Read();}
}
'@
try {
  switch ($Action) {
    'get' { $result=[HTSystemVolume]::Read() }
    'set' { $result=[HTSystemVolume]::Write($Volume) }
    'mute' { $result=[HTSystemVolume]::Mute($Muted) }
  }
  $result | ConvertTo-Json -Compress
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
