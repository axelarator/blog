---
title: "We Have Packet Capture at Home Pt. 2"
description: "With a dedicated lab for packet capturing, the next step I wanted to work on was a way to automate querying of network indicators to collect the pcaps and JA4 fingerprints. How the project has functioned up until now requires manually interacting with each endpoint individually, noting the captured fingerprints and/or certificate patterns, track what that IP relates to at that point in time, and any other context necessary to properly label the indicator. Now for targeted analysis, that's fine."
pubDate: 2026-07-28T15:48:39.000-06:00
heroImage: "/images/2026/07/EW7A7293.jpg"
heroImageCaption: "Fort Mill, SC"
tags: []
---

With a [dedicated lab for packet capturing](/we-have-packet-capture-at-home/), the next step I wanted to work on was a way to automate querying of network indicators to collect the pcaps and JA4 fingerprints. How the project has functioned up until now requires manually interacting with each endpoint individually, noting the captured fingerprints and/or certificate patterns, track what that IP relates to at that point in time, and any other context necessary to properly label the indicator. Now for targeted analysis, that's fine. Scope to a single destination and fixate on it. In most instances though, you aren't working with a single indicator. IOC lists in a report can be underwhelming if there isn't much detail to begin with or if the end-user only ever uses them for an X-day look back in their SIEM. Without some basic enrichment pipelines in place to first confirm the hosts are still live or already put in Microsoft's sinkhole network, those queries really aren't worth the effort. I'd suggest a hunt looking for the behavior that IP carried out and not the IP itself. The standard static/behavioral hunt methodology. Storing them as a record for an adversary will also reach obsolescence after a certain point. Who's reading CISA reports from last year and still tracking those indicators?

Anyway...that made me think about how I'm organizing intel reports myself. In the past, I used OpenCTI but quickly ran into the issue of collecting everything without a focus on something. I dockerized the problem I wanted to avoid. AlienVault OTX default feed is an easy way to collect all intel around if you don't want to build your own RSS feed but it can get overwhelming fast. If you want to then enrich your feeds with other vendor APIs and you aren't careful, you'll hit your weekly quota in a minute. Again, doing this manually with a set scope in mind provides a reason to enrich and you'll stay within your quota. Regardless, the immediate grouping of data made me realize how important it is to contextualize observables. Reading that back, it sounds obvious. Actually finding a meaningful workflow to do so is where it gets complicated. When every aspect of a report becomes a pivotable object, it allows analysts to do analyst work. Hashes may start to overlap with multiple China-nexus groups adding certainty they may share tooling or rely on the same MaaS, network ASN usage could signify shared hosting providers that could uncover staging infrastructure. This is where indicator lists go from a single-pass check to a point in time record that can be referred back to in future analysis. Those hosts may be dormant or gone entirely but there's a point-in-time reference as to what they were and who they belonged to. This is not a new idea but a reemerging issue. Many have written about it so I'll reference [DomainTools' post](https://www.domaintools.com/blog/analyzing-network-infrastructure-as-composite-objects) as I think they illustrate the solution quite well.

# AgenTIP

To achieve this for myself as a personal project, this meant creating some sort of Threat Intel Platform although defining that is quite a stretch given the scale of some vendor products in that space. Maybe something creative like Threat Intel Personal Platform. Sure, why not. The other requirement is that it can't be a manual process. Duh. I tried before with Obsidian to take notes and tag pages, add backlinks, and that lasted about a week. Embrace STIX and use that schema. It's superior for this kind of work.

The solution I came up with and admittedly Claude built is what I'm calling AgenTIP.

> Agentic + TIP = AgenTIP

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/axelarator/AgenTIP"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - axelarator/AgenTIP: Agentic threat-intel cluster tracking: MCP server + CLI for pivoting, active JA4+/JARM probing, TTP/STIX tracking, and hunt-log discipline.</div><div class="kg-bookmark-description">Agentic threat-intel cluster tracking: MCP server + CLI for pivoting, active JA4+/JARM probing, TTP/STIX tracking, and hunt-log discipline. - axelarator/AgenTIP</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon-71e5fbf9-e36c-4aa2-a0bd-80af6a308b5f.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">axelarator</span></div></div><div class="kg-bookmark-thumbnail"><img src="https://opengraph.githubassets.com/9e3f26418931423209d35f898f7e9199c005eb442b54ab96790f81a6d72b2137/axelarator/AgenTIP" alt="" onerror="this.style.display = 'none'"></div></a></figure>

I want to make it clear that I'm aware this is a vibe coded "AI slop" project but it is purpose built to be a tool to work alongside an analyst. I did not go into this trying to create an all-in-one tool for infrastructure pivoting.

A brief TL;DR of what this agent does:

Give it a link to a threat intel report and it will at minimum summarize, extract observables, and build/update a cluster so future reports can be grouped. All extracted content is stored as a STIX bundle so relationships can be built as the data store expands. Pivot tools passively enrich indicators to check status via RDAP, RipeStat, CertSpotter, and VirusTotal. Probe tools actively enrich indicators to gather JARM/JA4+ fingerprints. Tools are managed through a local MCP server and if you have the hardware to run local models, a Pi directory is included with a mirrored skills file. I have an 8Gb 3070ti so I didn't get very far.

```markdown
Report ingestion & analysis
- ingest_report — bring a new report into the store
- analyze_report — extract structured intel (observables, TTPs, etc.) from a report

Clusters (grouping of related activity/infrastructure)
- create_cluster, get_cluster, list_clusters
- pivot_cluster — pivot from a cluster to find related entities
- update_profile — update a cluster's profile/metadata

Observables
- add_observable, remove_observable, find_observable, get_observables
- pivot_observable — find related infrastructure/indicators from one observable
- pivot_and_expand — broader pivot that expands the graph, not just a single hop

TTPs, detections, gaps
- update_ttp, remove_ttp — manage MITRE ATT&CK technique associations
- get_technique_usage — see how/where a technique shows up across the store
- add_detection — record a detection rule/coverage item
- add_gap, update_gap, remove_gap — track detection/intel gaps

Relationships
- add_relationship — link entities (e.g., observable-to-cluster, TTP-to-actor)

Fingerprinting pipeline (this ties to the recent "Arkime/OpenSearch VM" and "concurrent dispatch" commits)
- list_pending_fingerprints, pop_pending_fingerprints, requeue_fingerprint

Hunting
- append_hunt_log — record hunt activity/notes

STIX interop
- import_stix_bundle — bring in external STIX data
- export_stix_bundle, export_stix_ecosystem — export a cluster or the whole ecosystem as STIX
- export_navigator_layer — generate a MITRE ATT&CK Navigator layer for visualization
```

This is a great first step to building out an actor profile because now with any other mentioned adversaries or malware, further research into those can build a larger picture of a threat actor's capabilities. For example, from Microsoft's report on [Fox Tempest](https://www.microsoft.com/en-us/security/blog/2026/05/19/exposing-fox-tempest-a-malware-signing-service-operation/) which is a MaaS operator, they also mention Vanilla Tempest. Vanilla Tempest is a paying customer since June 2025 and utilized Fox Tempest's malicious signing service to validate an MSTeamsSetup.exe binary. They distributed the binary via malvertising/SEO poisoning, then dropped Oyster backdoor and sometimes Rhysida ransomware. This is all good for a threat brief but what about the observables specific to this activity? How do you make use of past data? To keep observables relevant and create pivot opportunities, that's where the network tools come in.

To describe the solution, I first want to reiterate how the lab itself works. Although the agent automates the interaction with the network observables, it's not something I'd recommend you run on your main system or even a VM bridged to your home network. There is a specific network architecture design to safely run this which is relevant to my own environment but you don't have to follow it exactly. My last post covers it in more detail but I'll reiterate here since some minor tweaks occurred since then.

Within my home network contains VLAN30 on a tagged port with rules to isolate it from the rest of my home network. Proxmox is wired to that port so it sits on that VLAN and runs it's own internal network using OPNsense with 4 NICs; WLAN, LAN, OPT1, OPT2. LAN contains all of my monitoring tools like Arkime with OpenSearch Dashboard, a Zeek VM, Wazuh server, and an agent VM. One of the OPT interfaces runs a Windows 11 VM which is where network traffic is captured from. Open vSwitch bridges are set to mirror all traffic from vmbr30 back to the Zeek/Arkime TAP ports. OPNsense also uses selective routing so the vmbr30 network always goes through a WireGuard VPN tunnel. The Windows VM generating network telemetry is safe from leaking my ISP WAN and WireGuard DNS with a killswitch ensures all routing traffic goes through the tunnel, not VLAN30. The malicious server I'm interacting with only sees traffic from a VPN while my network logs show local VM addresses connecting to public endpoints.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image.png" class="kg-image" alt="" loading="lazy" width="800" height="450"></figure>

Back to business. When observables are captured from a report, usually all you get are the IPs. Maybe ports if you're lucky. The first step of the analysis process is to enrich and pivot. Ok two parts. To do so, the agent uses a few tools which are free to use without an account or API key. VirusTotal is the only (optional) one that requires an API key. Even though they're free tools, I still go through the VPN.

*   RDAP for registration data
*   RIPEstat for ASN/network context
*   Cert Spotter for certificate-transparency history
*   Hackertarget for reverse-IP co-hosting
*   VirusTotal for reputation + resolution history

During this stage, false positives will be ruled out if the agent notices a domain like ipinfo.io. Yeah malware can use it to determine the victim's IP but it's not necessary to enrich that. Keep note of it in the campaign though for reference. Pivoting will take an IP and find domains from A records or a domain's IP history and note any additional observables. This part is more false positive prone but can yield some useful findings. Here's an example from a recent Silver Fox pivot:

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-5.png" class="kg-image" alt="" loading="lazy" width="1776" height="462"></figure>

With pivoting done and a list of actor-controlled or similar observables filtered down, the second step is probing. The agent connects to Windows via an SSH authorized key and sends a queued list of captured indicators to generate active server response fingerprints. Zeek logs are already pushed to OpenSearch so the agent queries the OpenSearch API to pull relevant fingerprints that it captured. For JARM, it runs the [Python script](https://github.com/salesforce/jarm) manually since JARM is not passively captured.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-6.png" class="kg-image" alt="" loading="lazy" width="1438" height="744"></figure>

The fingerprint values I show in this post should not be treated as a single source of truth that every vendor / tool will treat the same. JARM is less picky though. If you were scan these hosts yourself, you _might_ receive different JA4+ fingerprints. Since there are different ways to generate a server response, there can also be multiple fingerprints for JA4S and JA4TS (TLS and TCP server responses). For example, since I'm capturing via Zeek, I'm not using the ja4tscan.py script designed for Zmap which would include additional retransmission packets. My captured values might be `65535_2-1-3-1-1-4_1460_8` while some vendors will have `65535_2-1-3-1-1-4_1360_8_1-2`. My goal here isn't to create a mapping of "is what I have equal to what a vendor has" because of what I eluded to above. There's also the chance some servers will have the same fingerprints but not actually be related. The agent is aware of this and can callout cases where a match may not be a true infrastructure match.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-7.png" class="kg-image" alt="" loading="lazy" width="1770" height="936"></figure>

There is a chance I find some confirmed matches with JA4DB but I don't want to rely on it. If I'm generating my own telemetry, I can build my own baselines and find the outliers there. [](https://platform.censys.io/hosts/185.112.36.239?org=31a7bac9-0070-4e2e-bbb2-c94d335a7c0f#MSSQL-1433-TCP)Regardless, although I can gather this data myself, this tool has already helped organize it in a way for it to be a useful record lookup.

# Dashboard

From the few screenshots I've shown, you might have guessed there's some UI element to this tool. After all, I didn't go through all this effort to search and interact solely through the terminal. A minimal dashboard was built to easily navigate the clusters and search stored objects. It's not complete nor do I ever think it will be but it's also not overly complex. As a reminder, the data presented is only as good as the data fed in and how Claude decided to convey it. So far, each cluster is only sourced from maybe three reports max. I'm mainly focused on the indicators anyway since I can read the reports and adjust verbiage afterwards. I can read I promise.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/tenor.gif" class="kg-image" alt="" loading="lazy" width="480" height="360"></figure>

The main dashboard shows the latest hunt logs and metrics for everything stored. Technique matrix lists all TTPs and who uses them. Fingerprint queue only populates when active network scanning is about to take place. The clusters list is built by each report being designated a cluster either by myself or Claude's discretion.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-10.png" class="kg-image" alt="" loading="lazy" width="2000" height="1101"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-9.png" class="kg-image" alt="" loading="lazy" width="2000" height="1101"></figure>

Open gaps cut off at the bottom lists any current analysis gaps that the agent could not currently detect or verify.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-11.png" class="kg-image" alt="" loading="lazy" width="2000" height="428"></figure>

Lastly, for the stored observables, they are organized into respective groups with hyperlinks depending how they were sourced. The report directly, a VT URL from a pivot, or Arkime for a direct pcap view.

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-13.png" class="kg-image" alt="" loading="lazy" width="2000" height="685"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-12.png" class="kg-image" alt="" loading="lazy" width="2000" height="841"></figure>

Taking it one step further, I added a value action (right-click action) within Arkime's dashboard so I can view the community ID in OpenSearch and it will take me to the Zeek log event in OpenSearch.

```
[value-actions]
OSD=url:http://10.20.0.18:5601/app/data-explorer/discover#?_q=(query:(language:kuery,query:'community_id:"%URIEncodedText%"'));name:Zeek logs (Community ID);fields:communityId
```

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-14.png" class="kg-image" alt="" loading="lazy" width="1422" height="1376"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-15.png" class="kg-image" alt="" loading="lazy" width="2000" height="792"></figure>

# Findings

Alright, so this took a lot of time to get the tool to this point. Has anything of interest come from these disparate sources of intel and active scanning? A few things!

## Moving Pieces

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-5.png" class="kg-image" alt="" loading="lazy" width="1776" height="462"></figure>

I'll use this example from earlier. I originally scanned this domain on July 12th when it was under the 61.111.x.x IP. After making adjustments to the active scanning pipeline, I tested again with stored data. The agent found that what was once a dormant domain reappeared under a new IP along with 8 other domains. I confirmed this finding with Validin and even in between those two dates, it resolved to another IP. Silver Fox is busy!

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-16.png" class="kg-image" alt="" loading="lazy" width="2000" height="1205"></figure>

For context, here's the report that domain came from.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://hexastrike.com/resources/blog/threat-intelligence/trust-the-tunnel-get-the-trojan-silver-fox-delivers-atlas-rat-via-weaponized-vpn-installers/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Trust the Tunnel, Get the Trojan: Silver Fox Delivers Atlas RAT via Weaponized VPN Installers - Hexastrike Cybersecurity</div><div class="kg-bookmark-description">Executive Summary A multi-stage remote access trojan campaign is actively targeting Chinese-speaking users through a network of typosquatted domains impersonating trusted software brands. The operation covers VPN clients, encrypted messengers, video conferencing tools, cryptocurrency trackers, and e-commerce applications, with eleven confirmed delivery domains impersonating brands including Surfshark VPN, Signal, Telegram, Zoom, Microsoft Teams, and others. […]</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="https://static.ghost.org/v5.0.0/images/link-icon.svg" alt=""><span class="kg-bookmark-author">Hexastrike Cybersecurity</span><span class="kg-bookmark-publisher">Maurice Fielenbach</span></div></div><div class="kg-bookmark-thumbnail"><img src="https://hexastrike.com/wp-content/uploads/2026/03/hx_silverfox_atlascross_overview-1024x446.png" alt="" onerror="this.style.display = 'none'"></div></a></figure>

## JA4TS

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-17.png" class="kg-image" alt="" loading="lazy" width="627" height="399"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2026/07/image-18.png" class="kg-image" alt="" loading="lazy" width="2000" height="452"></figure>

I have a limited set of data so far but that also works in my favor. When there are overlaps, that's something worth exploring. Now the idea of JA4 is amazing. It definitely adds a new layer of identity to an endpoint but it should not be treated as a one:one relationship. What I mean is if you look at the [number of JA4TS values](https://platform.censys.io/search/report/data/table?q=%28host.services.threats.name+%3D+%22Sliver%22+or+web.threats.name+%3D+%22Sliver%22%29+and+host.ip%3A+*&org=31a7bac9-0070-4e2e-bbb2-c94d335a7c0f&field=host.services.ja4tscan.fingerprint&num_buckets=500&filter_query=true&count_by=.) for Sliver, there are just over 50. So just because you found one does not mean every server with that fingerprint is a Sliver server. The most common fingerprint in that list on it's own exists in over 17.7 million hosts.

I'll counter that now with the finding above. In this instance, Silver Fox and TA4922 share the same value. This value exists in just 33 hosts on the internet. Compared to the other value that is on 17.7 million hosts, that's not bad. We can work with that. Considering ProofPoint also mentions TA4922 and Silver Fox are related, this adds a bit more confidence to the overlap.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://www.proofpoint.com/us/blog/threat-insight/ta4922-suspected-chinese-crime-group-going-global"><div class="kg-bookmark-content"><div class="kg-bookmark-title">TA4922: The Suspected Chinese Crime Group is Going Global | Proofpoint US</div><div class="kg-bookmark-description">Key Findings: TA4922 is a highly sophisticated threat actor demonstrating a rapid operational tempo and continually evolving malware arsenal. The group has been</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon-192x192-90fdecaa-6586-41bf-b4f4-ba2b6d98d31e.png" alt=""><span class="kg-bookmark-author">Proofpoint</span><span class="kg-bookmark-publisher">The Proofpoint Threat Research Team</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/pfpt-us-europe-connect.jpg-4b21b81e-42b7-434b-94c5-91a354d95232.webp" alt="" onerror="this.style.display = 'none'"></div></a></figure>

> TA4922 activity shows overlap in tooling, infrastructure, and social engineering themes with activity reported by other researchers as [Silver Fox or Void Arachne](https://malpedia.caad.fkie.fraunhofer.de/actor/void_arachne).

Admittedly, the VT Graph I created of all these IPs didn't pull any immediate overlaps of shared files or commonly resolved domains. So close yet so far.

# Conclusion

Those two findings so far show that as more data is fed in, a larger picture is built out that conveys similarities. It's an almost self-hosted solution if you have the hardware and I don't need to manage multiple API keys to get most of the public data available. Some services would be nice to have but that's a cost I can't afford. Overall though this tool has become very useful in organizing a select list of reports to focus on a few topics at a time rather than sifting through a barrage of feeds every day.
