---
title: "Hunting for EDR-Freeze"
description: "EDR bypassing has become a technique of choice for threat actors and has enabled a market of tools being sold on cybercrime forums:"
pubDate: 2025-10-31T12:01:42.000-06:00
heroImage: "/images/2025/10/DSCF1323-2.JPG"
heroImageCaption: "Snowboarding in Colorado"
tags: []
---

EDR bypassing has become a technique of choice for threat actors and has enabled a market of tools being sold on cybercrime forums:

*   [Unit42](https://unit42.paloaltonetworks.com/edr-bypass-extortion-attempt-thwarted/?utm_source=chatgpt.com) uncovered a variant of [EDRSandBlast](https://github.com/wavestone-cdt/EDRSandblast) being sold on XSS and Exploit.
*   CheckPoint Research uncovered the use of a vulnerable driver, Truesight.sys, which evaded the Microsoft Vulnerable Driver Blocklist and allowed the adversary to carry out further actions such as delivering the Gh0st RAT payload.
*   Other public tools like EDRSilencer, EDRKillShifter, and Terminator demonstrate the ease in abusing vulnerable drivers.
*   [LOLDrivers](https://www.loldrivers.io/) is a curated list of Windows drivers used by adversaries. Reference this for an even longer list of threat vectors.
*   [BYOVD research](https://github.com/BlackSnufkin/BYOVD)
*   [In early September 2024](https://www.crowdstrike.com/en-us/blog/falcon-prevents-vulnerable-driver-attacks-real-world-intrusion/), a CrowdStrike customer experienced an intrusion where the adversary brought six vulnerable drivers in an attempt to bypass the Falcon sensor. All were detected or blocked by Falcon BYOVD protections. 
*   You get the point

Regardless of what tool or driver is used, the goal of bypassing EDR/AV allows disabling security products, dumping privileged processes, and carrying out activity under the radar.

The Bring Your Own Vulnerable Driver (BYOVD) technique itself has become so popular lately that even MITRE has added a piece about it in their description for [Create or Modify System Process: Windows Service (T1543.003)](https://attack.mitre.org/techniques/T1543/003/) and [Exploitation for Privilege Escalation (T1068)](https://attack.mitre.org/techniques/T1068/). Although execution after successful deployment of a vulnerable driver may ease the attack path, finding a way to first install and execute vulnerable drivers isn't.

Luckily, that isn't the only way to tamper with endpoint monitoring.

# EDR-Freeze

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/TwoSevenOneT/EDR-Freeze"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - TwoSevenOneT/EDR-Freeze: EDR-Freeze is a tool that puts a process of EDR, AntiMalware into a coma state.</div><div class="kg-bookmark-description">EDR-Freeze is a tool that puts a process of EDR, AntiMalware into a coma state. - TwoSevenOneT/EDR-Freeze</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">TwoSevenOneT</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/EDR-Freeze" alt="" onerror="this.style.display = 'none'"></div></a></figure>

This tool takes a different approach. Rather than attempting to exploit existing drivers or load others, it simply puts the security solutions to sleep for a specific time and resumes their state after.

TL;DR up front:

> By using WerFaultSecure and modifying it to run as a PPL with a protection level of WinTCB, it can call MiniDumpWriteDump to suspend EDR/AV processes for a set time. With the process suspended, further malicious activity can execute within the specified sleep time to evade detection.

Those two sentences covered a lot so I'll break it down.

## Protected Process Light

**Protected Process Light (PPL)** is a Windows security feature introduced in Windows 8.1 that prevents other processes from tampering with, terminating, or accessing the memory of critically important system services and anti-malware applications.

If you've ever interacted with LSA like using Mimikatz to dump credentials, you know that accessing memory regions of `lsass.exe` is extremely noisy and quick to detect. To counter this attack, Microsoft introduced Protected Process Light (PPL). When `lsass.exe` runs as a PPL process, untrusted user-mode applications can no longer obtain read-permissible handles to its memory, and security packages loaded by the LSA must be signed with a trusted certificate. These safeguards aren't perfect though as a tool like [PPLKiller](https://github.com/RedCursorSecurityConsulting/PPLKiller) is able to bypass LSA protection. Mimikatz even added a way to bypass this too.

```bash
mimikatz # !+
mimikatz # !processprotect /process:lsass.exe /remove
mimikatz # privilege::debug
mimikatz # sekurlsa::logonpasswords
```

PPL has a hierarchy system for processes. Digital signatures verify integrity and allow certain operations based on which PPL signature is used, higher privileged processes are immune from tampering by lower-privileged ones, and PPL processes can only be modified by other processes with a higher PPL level.

PPL signer types include WinTcb, Windows, Lsa, Antimalware, and Authenticode but not [that](/abusing-code-signing-certificates/) Authenticode. In the hierarchical chain, WinTcb is the highest and Authenticode is the lowest.

The hierarchy continues when discussing Protected Process (PP) vs Protected Process Light (PPL):

*   A PP can open a PP or a PPL with full access, as long as its signer level is greater or equal;
*   A PPL can open another PPL with full access, as long as its signer level is greater or equal;
*   A PPL cannot open a PP with full access, regardless of its signer level.

For EDR-Freeze to work, it needs to bypass the PPL protection level of EDRs and Antivirus.

To run an executable with PPL (Protected Process Light) protection, the executable and any loaded DLLs must be signed with a specific certificate and have their digital signatures verified by the operating system, as detailed in the Anti-malware service signing requirements. The signature for PPL is called Enhanced Key Usage (EKU).

*   [https://learn.microsoft.com/en-us/openspecs/windows\_protocols/ms-ppsec/651a90f3-e1f5-4087-8503-40d804429a88](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-ppsec/651a90f3-e1f5-4087-8503-40d804429a88)

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/10/image-19.png" class="kg-image" alt="" loading="lazy" width="530" height="594"><figcaption><span style="white-space: pre-wrap;">WerFaultSecure EKU</span></figcaption></figure>

To create a process and enable this PPL functionality, the `CreateProcess` function must use the `dwCreationFlags` `EXTENDED_STARTUPINFO_PRESENT | CREATE_PROTECTED_PROCESS`.

```cpp
BOOL CreateProcessW(
  [in, optional]      LPCWSTR               lpApplicationName,
  [in, out, optional] LPWSTR                lpCommandLine,
  [in, optional]      LPSECURITY_ATTRIBUTES lpProcessAttributes,
  [in, optional]      LPSECURITY_ATTRIBUTES lpThreadAttributes,
  [in]                BOOL                  bInheritHandles,
  [in]                DWORD                 dwCreationFlags,
  [in, optional]      LPVOID                lpEnvironment,
  [in, optional]      LPCWSTR               lpCurrentDirectory,
  [in]                LPSTARTUPINFOW        lpStartupInfo,
  [out]               LPPROCESS_INFORMATION lpProcessInformation
);
```

A separate tool exists to automate this and is actually used in EDR-Freeze as well.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/TwoSevenOneT/CreateProcessAsPPL"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - TwoSevenOneT/CreateProcessAsPPL: This is the loader that supports running a program with Protected Process Light (PPL) protection functionality.</div><div class="kg-bookmark-description">This is the loader that supports running a program with Protected Process Light (PPL) protection functionality. - TwoSevenOneT/CreateProcessAsPPL</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40-1.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">TwoSevenOneT</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/CreateProcessAsPPL" alt="" onerror="this.style.display = 'none'"></div></a></figure>

From the CreateProcessAsPPL code, this can be seen in line 114.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/image-18.png" class="kg-image" alt="" loading="lazy" width="681" height="377"></figure>

## Windows Error Reporting

Now onto the part about `WerFaultSecure.exe` calling `MiniDumpWriteDump`.

`WerFaultSecure.exe` is a part of the Windows Error Reporting (WER) service. `WerFault.exe` is also part of WER but the "secure" process handles reports from protected processes. In the screenshot below, notice how WerFault does not have Protected Process Verification or Windows TCB Component. WerFaultSecure collects crash dumps of PPL processes which means it has the ability to run with PPL protection at the WinTCB level.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/10/image-20.png" class="kg-image" alt="" loading="lazy" width="530" height="594"><figcaption><span style="white-space: pre-wrap;">WerFault EKU</span></figcaption></figure>

## MiniDumpWriteDump

The [MiniDumpWriteDump](https://learn.microsoft.com/en-us/windows/win32/api/minidumpapiset/nf-minidumpapiset-minidumpwritedump) function from `DbgHelp.dll` creates a snapshot of its memory and state for debugging which also requires target process threads to be suspended.

This function is very well known for dumping LSASS too.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://www.ired.team/offensive-security/credential-access-and-credential-dumping/dumping-lsass-passwords-without-mimikatz-minidumpwritedump-av-signature-bypass"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Dumping Lsass without Mimikatz with MiniDumpWriteDump | Red Team Notes</div><div class="kg-bookmark-description">Evasion, Credential Dumping</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/image" alt=""><span class="kg-bookmark-author">Red Team Notes</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/-LafIF6VCybVpgbjcbLd" alt="" onerror="this.style.display = 'none'"></div></a></figure>

With all of that in mind, a normal process (EDR-Freeze) can run a new process with PPL protection (using CreateProcessAsPPL), then during the CreateProcess function call, you can force the child PPL process to suspend by using the `CREATE_SUSPENDED` flag. The child process in this case being EDR/AV. A child process can be created in a suspended state, then use `OpenProcess` with the `PROCESS_SUSPEND_RESUME` privilege to resume it.

If this can be done on a PPL process, then that process can be suspended.  
WerFaultSecure performs the dump, calls MiniDumpWriteDump on EDR/Antivirus processes, suspends WerFaultSecure, and now the target process is suspended indefinitely because WerFaultSecure has also been suspended.

This does not stop the process forever but allows further activity to be carried out during the sleep time so that they are not monitored.

# Hunt Methodology

Now it's time to execute EDR-Freeze and create telemetry to analyze host-based activity of the tool. I'll be using my ConstructingDefense Ludus range as it already has Splunk and Sysmon running. See my [previous post](/homelabs-dont-end-they-improve/) about automating range deployments.

Since this range is only running Windows Defender, the target process to focus on is `MsMpEng.exe`. To gather the PID, I'm taking the boring route and viewing the process directly on the victim machine since I'm only focused on the process activity, not building a threat simulation.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/10/image-28.png" class="kg-image" alt="" loading="lazy" width="944" height="178"><figcaption><span style="white-space: pre-wrap;">MsMpEng PID</span></figcaption></figure>

One part I forgot to mention that makes this _a bit_ less trivial to exploit is that EDR-Freeze needs to be run as Administrator.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/image-27.png" class="kg-image" alt="" loading="lazy" width="938" height="592"></figure>

Great! SeDebugPrivilege was enabled, a PPL process was created (WerFaultSecure), Protection Level was set to 5 (WinTcb), MsMpEng was suspended, and after 10 seconds the command exited which stopped WerFaultSecure allowing MsMpEng to resume.

Error deleting file: 2 comes from MiniDumpWriteDump created a dump file in the current working directory. It's just a text file so I'm unsure why it can't delete it but it's good to know because that's another artifact to look for.

## Splunk Logs

Recall how EDR-Freeze works:

> By using WerFaultSecure and modifying it to run as a PPL with a protection level of WinTCB, it can call MiniDumpWriteDump to suspend EDR/AV processes for a set time.

Looking at the logs, a process gets created showing the arguments for EDR-Freeze and then EDR-Freeze loads itself into memory. We then see a dump file gets written to the current working directory EDR-Freeze was executed from. Lastly, the top two logs show EDR-Freeze accessing WerFaultSecure and then WerFaultSecure accessing MsMpEng. Notice too how EDR-Freeze passes 3520 as the PID and then MsMpEng is executed with the same PID.

<figure class="kg-card kg-image-card kg-width-wide"><img src="/images/2025/10/image-31.png" class="kg-image" alt="" loading="lazy" width="2000" height="536"></figure>

<figure class="kg-card kg-image-card kg-width-wide"><img src="/images/2025/10/image-30.png" class="kg-image" alt="" loading="lazy" width="1096" height="572"></figure>

I couldn't capture the exact activity of WerFaultSecure executing MiniDumpWriteDump as it resides in memory. To get as close as possible, the CallTrace field can uncover modules that the process loads. Referencing the Microsoft documentation for the function, it comes from either `Dbghelp.dll` or `Dbgcore.dll`.

<table aria-label="Requirements" class="table table-sm margin-top-none"><thead><tr><th>Requirement</th><th style="text-align: left;">Value</th></tr></thead><tbody><tr><td><strong>Target Platform</strong></td><td style="text-align: left;">Windows</td></tr><tr><td><strong>Header</strong></td><td style="text-align: left;">minidumpapiset.h (include Dbghelp.h)</td></tr><tr><td><strong>Library</strong></td><td style="text-align: left;">Dbghelp.lib</td></tr><tr><td><strong>DLL</strong></td><td style="text-align: left;">Dbghelp.dll; Dbgcore.dll</td></tr><tr><td><strong>Redistributable</strong></td><td style="text-align: left;">DbgHelp.dll and Dbgcore.dll</td></tr></tbody></table>

Looking at the CallTrace, dbgcore.dll is present. The characters after .DLL represent the offset.

<figure class="kg-card kg-image-card kg-width-wide"><img src="/images/2025/10/image-32.png" class="kg-image" alt="" loading="lazy" width="1914" height="320"></figure>

## Hunt Queries

After looking at the log output, some queries can be built to match observed patterns.

### EDR-Freeze Process Execution

Looking for events where any process execution matches the same pattern of EDR-Freeze with two numerical parameters for the target PID and sleep time in milliseconds.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/10/image-21.png" class="kg-image" alt="" loading="lazy" width="1234" height="486"><figcaption><span style="white-space: pre-wrap;">EDR-Freeze takes two arguments; a TargetPID and SleepTime</span></figcaption></figure>

```spl
index=* Computer="cd-WIN11V.condef.local"
| regex process="(?i)^(?P<exe>[\w:\\\/.\- ]+?\.exe)\s+(?P<pid>\d{3,5})\b\s+(?P<sleep>\d+)\b$"
| table _time EventID EventDescription ImageLoaded process TargetFilename parent_process_name parent_process_path process_exec process_id
```

<figure class="kg-card kg-image-card kg-width-wide"><img src="/images/2025/10/image-33.png" class="kg-image" alt="" loading="lazy" width="2000" height="502"></figure>

### Process Dump File Creation

EDR-Freeze creates a dump file right after execution. Using time correlation between the two events, this query matches any time an executable writes a file immediately after.

```spl
index=sysmon EventCode IN (1,11)
| eval EventType=case(EventCode==1, "ProcessCreate", EventCode==11, "FileCreate")
| stats 
    earliest(_time) as firstTime 
    latest(_time) as lastTime 
    values(EventType) as eventTypes 
    values(Image) as Images 
    values(TargetFilename) as TargetFilenames 
    by Computer, ProcessId
| table Computer, ProcessId, Images, TargetFilenames, firstTime, lastTime
```

<figure class="kg-card kg-image-card kg-width-wide"><img src="/images/2025/10/image-34.png" class="kg-image" alt="" loading="lazy" width="2000" height="656"></figure>

### WerFaultSecure Execution

Similar to the above query, WerFaultSecure should load nearly immediately after EDR-Freeze. This query will correlate PID values instead of time deltas. Since EDR-Freeze requires the PID of an AV/EDR process and WerFaultSecure has to pass a PID to MiniDumpWriteDump so that it can suspend a process, both processes executing will have the same PID in the command line execution. One addition here is to look for the inclusion of dbghelp.dll or dbgcore.dll in the CallTrace field to limit false positive hits.

```spl
index=sysmon EventCode IN (1,10)
| eval EventType=case(EventCode==1,"ProcessCreate", EventCode==10,"ProcessAccess")
| rex field=CommandLine "(?i)^(?<exe>[\w:\\\/.\- ]+?\.exe)\s+(?<pid>\d{3,5})\b\s+(?<sleep>\d+)\b$"
| eval pid = coalesce(pid, tostring(process_id))
| where isnotnull(pid)
| where (EventType!="ProcessAccess") OR like(CallTrace,"%dbghelp%") OR like(CallTrace,"%dbgcore%")
| stats values(EventType) as EventTypes
        values(CommandLine) as CommandLines
        values(Image) as Images
        values(TargetImage) as TargetImages
        values(SourceImage) as SourceImages
        values(CallTrace) as CallTrace
    by Computer, pid
| where mvcount(EventTypes) > 1 
      AND match(mvjoin(EventTypes, ","), "ProcessCreate")
      AND match(mvjoin(EventTypes, ","), "ProcessAccess")
| table Computer, pid, EventTypes, CommandLines, Images, SourceImages, TargetImages, CallTrace
```

<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="/images/2025/10/image-35.png" class="kg-image" alt="" loading="lazy" width="2000" height="1051"><figcaption><span style="white-space: pre-wrap;">Matching PID value across events</span></figcaption></figure>

# Conclusion

EDR-Freeze eases tampering with security products by relying on existing defensive tools without worrying about exploiting vulnerabilities. Customizing the sleep time allows further activity to be carried out without worrying if the EDR/AV will detect it. Although there were only a handful of logs to look at, there were enough patterns to help hunt for this activity without relying on hard-coded file names or paths.

# Resources

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://www.zerosalarium.com/2025/09/EDR-Freeze-Puts-EDRs-Antivirus-Into-Coma.html"><div class="kg-bookmark-content"><div class="kg-bookmark-title">EDR-Freeze: A Tool That Puts EDRs And Antivirus Into A Coma State</div><div class="kg-bookmark-description">EDR-Freeze exploits the vulnerability of WerFaultSecure to suspend the processes of EDRs and Antimalware, halting the operation of Antivirus and EDR</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon.ico" alt=""><span class="kg-bookmark-author">Blogger</span><span class="kg-bookmark-publisher">Zero Salarium</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/EDR-Frezee-20logo-20post.jpg" alt="" onerror="this.style.display = 'none'"></div></a></figure>

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://itm4n.github.io/ghost-in-the-ppl-part-1/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Ghost in the PPL Part 1: BYOVDLL</div><div class="kg-bookmark-description">In this series of blog posts, I will explore yet another avenue for bypassing LSA Protection in Userland. I will also detail the biggest challenges I faced while developing a proof-of-concept, and discuss some novel techniques and tricks to load an arbitrary DLL in LSASS, or even dump its memory.</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/apple-touch-icon-1.png" alt=""><span class="kg-bookmark-author">itm4n’s blog</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/twitter-ppldump-byovdll.png" alt="" onerror="this.style.display = 'none'"></div></a></figure>

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://itm4n.github.io/lsass-runasppl/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Do You Really Know About LSA Protection (RunAsPPL)?</div><div class="kg-bookmark-description">When it comes to protecting against credentials theft on Windows, enabling LSA Protection (a.k.a. RunAsPPL) on LSASS may be considered as the very first recommendation to implement. But do you really know what a PPL is? In this post, I want to cover some core concepts about Protected Processes and also prepare the ground for a follow-up article that will be released in the coming days.</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/apple-touch-icon-2.png" alt=""><span class="kg-bookmark-author">itm4n’s blog</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/01_regedit-runasppl.png" alt="" onerror="this.style.display = 'none'"></div></a></figure>
