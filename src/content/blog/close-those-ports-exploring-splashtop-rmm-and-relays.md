---
title: "Close Those Ports: Exploring Splashtop RMM and Relays"
description: "When looking for suspicious network connectivity, it's important to understand what other services might be running on the destination IP. It could be a harmless Python server with an open directory hosting files but additional analysis revealed it's running Empire at the same time. That open directory may not seem so benign now."
pubDate: 2025-11-06T11:55:43.000-07:00
updatedDate: 2025-11-06T12:29:07.000-07:00
heroImage: "/images/2025/11/DSCF1991.jpg"
heroImageCaption: "Raven in Moab, Utah"
tags: []
---

When looking for suspicious network connectivity, it's important to understand what other services might be running on the destination IP. It could be a harmless Python server with an open directory hosting files but additional analysis revealed it's running Empire at the same time. That open directory may not seem so benign now.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image.png" class="kg-image" alt="" loading="lazy" width="2000" height="2342"></figure>

Now what about less suspicious indicators like a residential IP hosting Plex, Grafana, and SSH for one of those servers because why not? In some cases, this could be a simple instance of UPnP forwarding ports on the user's behalf so they don't have to manually port forward products they want accessible outside of their home. With remote access services open to the internet though, this creates unwanted attention towards your network. It'll most likely be benign scanners but of course the internet isn't all safe. It can also attract scanners attempting to exploit vulnerable services or brute force login prompts with default configurations. See Zensec's latest [report](https://zensec.co.uk/blog/how-rmm-abuse-fuelled-medusa-dragonforce-attacks/) on Medusa/DragonForce abusing RMM tools.  
In any case, I wanted to explore RMM tools since leaving remote access ports open to the internet poses some serious risks of unwanted users gaining access to not just the network but remote management of desktops/laptops. One of those risks is exemplified in an earlier [post](/using-a-honeypot-to-capture-teamtnt-activity/) showing how an exposed Docker API port can result in crypto miners and botnet activity.

Looking back at some intel reporting, one RMM tool I didn't know much about was Splashtop. It has been used by [Medusa Group](https://attack.mitre.org/groups/G1051/), [APT44](https://www.microsoft.com/en-us/security/blog/2025/02/12/the-badpilot-campaign-seashell-blizzard-subgroup-conducts-multiyear-global-access-operation/), and [Scattered Spider](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a) so it has a notorious history of being used for nefarious activities. In the case of APT44:

> The use of RMM software allowed the threat actor to retain critical C2 functions while masquerading as a legitimate utility, which made it less likely to be detected than a remote access trojan (RAT).

Not knowing much about the tool beforehand besides it being for remote management, I did a simple keyword search in Censys to uncover any hosts exposing a Splashtop connection.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-1.png" class="kg-image" alt="" loading="lazy" width="2000" height="998"><figcaption><span style="white-space: pre-wrap;">(splashtop) and host.ip: *</span></figcaption></figure>

There are over 5,000 results and surely not _all_ of them are Splashtop services. Right? Looking at the ports list, the most common is 6783 / UNKNOWN with 443 / HTTP in close second. Yes 443 is HTTPS but Censys protocol labels don't separate HTTP from HTTPS. Since 6783 isn't tied to any protocol, it most likely isn't related to a login portal.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-2.png" class="kg-image" alt="" loading="lazy" width="2000" height="1054"><figcaption><span style="white-space: pre-wrap;">((splashtop) and host.ip: *) and host.services.port = "6783"</span></figcaption></figure>

Looking at any host matching that query, the certificate name seems very common. So common in fact that I generated a report to group all events by `host.services.cert.names` and found the assumption to be true.

*   99% of hosts have a cert name "Splashtop Inc. Self CA"
*   0.5% have "SRS"
*   0.07% have "\*.relay.splashtop.com"

This still doesn't explain "what" port 6783 is though. Time to find some documentation.

*   [https://support-splashtopbusiness.splashtop.com/hc/en-us/articles/360038221472-Enabling-Direct-connection-Local-Connections](https://support-splashtopbusiness.splashtop.com/hc/en-us/articles/360038221472-Enabling-Direct-connection-Local-Connections)
*   [https://support-splashtoponprem.splashtop.com/hc/en-us/articles/900000397406-Splashtop-Streamer-settings](https://support-splashtoponprem.splashtop.com/hc/en-us/articles/900000397406-Splashtop-Streamer-settings)

> Splashtop remote connections can be local (peer to peer) or remote through Splashtop relay servers.  Local connections, by default, use port TCP 6783.

That guide answers a few questions:

*   This documentation deals with Splashtop Streamer. "Install the Splashtop Streamer on any Windows, Mac, or Linux computers that you want to remotely access, view, and control from another device using the Splashtop app."
*   Splashtop remote connections are handled by Splashtop relay servers.
*   The default (although configurable) port is 6783.
*   The other two SSL certificate names make sense. SRS is most likely short for Splashtop Relay Service and they also use wildcard relay certs.
*   The default port isn't a specific filter anymore after doing the inverse of combining the three certificate names and pivoting on port.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-3.png" class="kg-image" alt="" loading="lazy" width="2000" height="1689"><figcaption><span style="white-space: pre-wrap;">The list keeps going</span></figcaption></figure>

# Banner Hash & Port

The first query really only covered any service on port 6783 and had the keyword Splashtop. That's not very specific and with thousands of results, it's prone to false positives.

I decided to pivot on another common value but included the port again to add some level of confidence. Even though the port can be changed, there are plenty of results to help find more commonalities across a host running Splashtop Streamer. That common value is the banner header for each response: `SRS:Ready\u0000`

The last few characters represent null value. Even though in search it just appends a blank space, it's not very user friendly to type in and can also be easy to forget.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-4.png" class="kg-image" alt="" loading="lazy" width="836" height="114"></figure>

Instead, I opted to use the banner hash of that value.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-15.png" class="kg-image" alt="" loading="lazy" width="2000" height="305"><figcaption><span style="white-space: pre-wrap;">host.services.port:6783host.services.banner_hash_sha256 = "5df2006c56654452aa889b55bb2b002c5326352c5d619cab3b05485a1eaef41e" and host.services.port:6783</span></figcaption></figure>

With over 12k results, this query was not much better but it could possibly be used in conjunction with another query in the future.

# SSL

Next is to focus on SSL content. From the first query, there were 3 common certificate names shared amongst these results.

The first being the most common certificate name "Splashtop Inc. Self CA". Based on a majority of operating systems and other services being related to desktops, this is a self-signed certificate by Splashtop for the Streamer software.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-5.png" class="kg-image" alt="" loading="lazy" width="1960" height="344"><figcaption><span style="white-space: pre-wrap;">(host.services.cert.parsed.issuer.common_name = "Splashtop Inc. Self CA") and host.ip:*</span></figcaption></figure>

This second certificate is a bit more interesting. I included more in the screenshot because what stood out to me is there are only two ASNs. All but one are tied to CELLCO-PART which operates as Verizon Business. Even when I removed the port number from the filter, the results stayed the same.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-6.png" class="kg-image" alt="" loading="lazy" width="1960" height="1428"><figcaption><span style="white-space: pre-wrap;">(((splashtop) and host.ip: *) and host.services.port = "6783") and host.services.cert.names = "SRS"</span></figcaption></figure>

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://www.sec.gov/Archives/edgar/data/1175215/000095010304001613/nov0504_.htm"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Cellco Partnership</div><div class="kg-bookmark-description"></div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="https://static.ghost.org/v5.0.0/images/link-icon.svg" alt=""></div></div></a></figure>

The certificate also has "Android" as the Organizational Unit which indicates these are for mobile systems. My guess here based on some more documentation is the Android signature is used for the Android Remote Control service for Splashtop Enterprise and Remote Support.

*   [https://www.splashtop.com/blog/remote-access-view-control-android-phones-tablets](https://www.splashtop.com/blog/remote-access-view-control-android-phones-tablets)
*   [https://www.splashtop.com/solutions/remote-desktop/android](https://www.splashtop.com/solutions/remote-desktop/android)

SRS is most likely the mobile Splashtop Relay Service which leads to the next question. Why is there another certificate called "\*.relay.splashtop.com"?

The last certificate only has two results. Knowing that port 6783 is default and enough documentation has showed me that other services use different ports, I removed it and the data became a lot more interesting.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-7.png" class="kg-image" alt="" loading="lazy" width="1900" height="476"><figcaption><span style="white-space: pre-wrap;">(((splashtop) and host.ip: </span><i><em class="italic" style="white-space: pre-wrap;">) and host.services.port = "6783") and host.services.cert.names = "</em></i><span style="white-space: pre-wrap;">.relay.splashtop.com"</span></figcaption></figure>

Most of the results here are on 443.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-8.png" class="kg-image" alt="" loading="lazy" width="1948" height="324"><figcaption><span style="white-space: pre-wrap;">((splashtop) and host.ip: </span><i><em class="italic" style="white-space: pre-wrap;">) and host.services.cert.names = "</em></i><span style="white-space: pre-wrap;">.relay.splashtop.com"</span></figcaption></figure>

Looking for [more information](https://support-splashtopbusiness.splashtop.com/hc/en-us/articles/115001811966-What-Are-the-Firewall-Exceptions-and-IP-addresses-of-Splashtop-Servers-Services) on relay servers, this certificate seems to be used for the wider range of data relays while the previous cert focused just on mobile relay connectivity. So all hosts in this query operate as relay servers.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-9.png" class="kg-image" alt="" loading="lazy" width="1562" height="708"></figure>

# Cleaning Up

I just showed a bunch of queries so I'll do my best to organize them in a way that can be used for tagging. If you weren't aware, the new Censys Platform includes Collections which allow you to store queries in the platform and monitor them over time.

## Splashtop Streamer

This query provides a good list of hosts using the identified Splashtop Streamer certificate with the hash of the banner response `SRS:Ready\u0000`. It doesn't include the default port since that was proven to not be the case for every host. At the time of writing, there are 2,610 active hosts. The `host.ip:*` option at the end isn't required. I just like to include it to look for only hosts and not web properties.

<figure class="kg-card kg-code-card"><pre><code>(host.services.cert.parsed.issuer.common_name = "Splashtop Inc. Self CA" and host.services.banner_hash_sha256 = "5df2006c56654452aa889b55bb2b002c5326352c5d619cab3b05485a1eaef41e") and host.ip:*</code></pre><figcaption><p><span style="white-space: pre-wrap;">Splashtop Streamer Query</span></p></figcaption></figure>

## Splashtop Relay

The certificates seemed to be the more important assets when looking at relays. I included both the mobile and general data relays into one since they both play a similar role. The `splashtop` keyword at the end helps reduce the false positive rate since I noticed unrelated services also having a certificate name `SRS`.

<figure class="kg-card kg-code-card"><pre><code>(host.services.cert.names = "SRS" or host.services.cert.names = "*.relay.splashtop.com") and splashtop</code></pre><figcaption><p><span style="white-space: pre-wrap;">Splashtop Relay Query</span></p></figcaption></figure>

# The Malware

From the first Splashtop query, you may have noticed a "Suspicious Directory" threat label. If not, surprise! Suspicious directories are open directories but hosting possibly malicious files. In this query, I'm just filtering on anything with the Suspicious Directory threat name.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-12.png" class="kg-image" alt="" loading="lazy" width="2000" height="330"><figcaption><span style="white-space: pre-wrap;">((splashtop) and host.ip: *) and (host.services.threats.name = "Suspicious Directory" or web.threats.name = "Suspicious Directory")</span></figcaption></figure>

From the results, none of the hosts are actually running Splashtop but they are hosting files where the filename _contains_ Splashtop, among other things.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-17.png" class="kg-image" alt="" loading="lazy" width="1312" height="1172"></figure>

With 4 hosts, I'll pick one that really stands out.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-10.png" class="kg-image" alt="" loading="lazy" width="1938" height="882"></figure>

IPv6, FTP, SSH, and HTTP. Not weird at all.

To see just how suspicious this IP is, I wanted to query it in VirusTotal but IPv6 isn't really something we can query, so what's next?

SSH key pivot! This revealed the IPv4 equivalent host.

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/images/2025/11/image-13.png" class="kg-image" alt="" loading="lazy" width="2000" height="1195"><figcaption><span style="white-space: pre-wrap;">host.services.ssh.server_host_key.fingerprint_sha256 = "2a4c3084ab5554e81111fd48af142e2fafc96611f339cec09e8dc7dd930044fc"</span></figcaption></figure>

Looking for some files in this directory on VirusTotal, a ZIP file actually contains some WinVNC malware. Other files not found on VirusTotal but present inside the open directory were other remote access tools like TeamViewer, AnyDesk, Remote Assistant Setup, Splashtop Streamer, and Splashtop Personal.

<figure class="kg-card kg-image-card"><img src="/images/2025/11/image-14.png" class="kg-image" alt="" loading="lazy" width="2000" height="1269"></figure>

To reiterate two key points at the beginning:

*   Medusa installed AnyDesk _after_ exploiting a SimpleHelp vulnerability.
*   From the APT44 report:

> The use of RMM software allowed the threat actor to retain critical C2 functions while masquerading as a legitimate utility, which made it less likely to be detected than a remote access trojan (RAT).

RMM tools left open to the public aren't only susceptible to exploitation and remote access from unwanted users. They are also used as a persistence mechanism to maintain access after getting into an environment which can be gleamed from the VirusTotal screenshot above.

# Conclusion

This post shows just how prevalent RMM tooling is for threat actors and how important it is to secure your devices at home. Just like how you can check HaveIBeenPwned for your email address in data breaches, I'd recommend querying a service like Censys or Shodan to figure out if there are any public services being hosted on your WAN. If you're unsure what that IP might be, you can visit [https://www.whatsmyip.org/](https://www.whatsmyip.org/) or if the CLI is more your speed, `curl ipinfo.io/ip`. If your IP is hosting any services, ensure you know why, then find a better way to make them accessible from outside. Maybe setup a Wireguard tunnel, Tailscale if you want a mesh Wireguard network, or host them through a reverse proxy like Traefik or Nginx.

# References

*   [https://www.microsoft.com/en-us/security/blog/2025/02/12/the-badpilot-campaign-seashell-blizzard-subgroup-conducts-multiyear-global-access-operation/](https://www.microsoft.com/en-us/security/blog/2025/02/12/the-badpilot-campaign-seashell-blizzard-subgroup-conducts-multiyear-global-access-operation/)
*   [https://attack.mitre.org/groups/G1051/](https://attack.mitre.org/groups/G1051/)
*   [https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a)
