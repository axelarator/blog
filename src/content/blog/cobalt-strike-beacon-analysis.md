---
title: "Cobalt Strike Beacon Analysis"
description: "I've written before about how servers with open directories can make it easy to deploy malware but in this post I'll explore a benefit of a single open directory on a site, https://beaconbeagle.com/, which hosts configuration files of Cobalt Strike beacons."
pubDate: 2025-12-29T13:54:25.000-07:00
updatedDate: 2026-01-11T13:14:51.000-07:00
heroImage: "/images/2025/12/DSCF0587.jpg"
heroImageCaption: "Near Estes Park, CO"
tags: []
---

I've written [before](/close-those-ports-exploring-splashtop-rmm-and-relays/) about how servers with open directories can make it easy to deploy malware but in this post I'll explore a benefit of a single open directory on a site, [https://beaconbeagle.com/](https://beaconbeagle.com/), which hosts configuration files of Cobalt Strike beacons.

Thanks to some link sharing by the [CuratedIntel](https://www.linkedin.com/company/curatedintelligence/posts/?feedView=all) group, this site caught my curiosity by providing IPs hosting Cobalt Strike beacons and the decoded configurations of the payload associated.

# Beacon Configs

Cobalt Strike leverages an implant (beacon) that relies on a malleable C2 profile which stores the beacon configuration. The official docs for building Cobalt Strike configs can be found [here](https://hstechdocs.helpsystems.com/manuals/cobaltstrike/current/userguide/content/topics/post-exploitation_main.htm?cshid=1085).

Parsing these configurations can uncover atomic indicators that are useful for filtering on known profiles. Something [Censys](https://censys.com/blog/using-cobalt-strike-to-find-more-cobalt-strike) had recently posted about.

Some useful fields in a config file include:

*   watermark - a unique value associated with the Cobalt Strike license
*   SETTING\_PUBKEY - the RSA public key of the beacon
*   SETTING\_DOMAINS - the beacon IP and URI path used to interact with the beacon
*   SETTING\_SPAWNTO\_X64/X86 - what process to startup as a child process
*   SETTING\_USERAGENT - what user agent the beacon uses

I had tried years before when learning Golang (emphasis on learning) to uncover Cobalt Strike beacon IPs by their JARM signature and attempt to extract the configuration in order to conduct further malware analysis. The code was messy but the feature was there.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/axelarator/gollector"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - axelarator/gollector</div><div class="kg-bookmark-description">Contribute to axelarator/gollector development by creating an account on GitHub.</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40-6.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">axelarator</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/gollector" alt="" onerror="this.style.display = 'none'"></div></a></figure>

Looking back, one issue I had when writing this was the forced reliance on VirusTotal and the Nmap script to parse said beacon config. With a site like BeaconBeagle hosting a large number of configs readily available, that eases the prerequisite of obtaining configs so that more time can be spent on uncovering patterns between profiles.

# Analysis

Given this random set of IPs, I built a Jupyter notebook to merge everything into one dataframe with the goal of finding similarities and differences amongst Cobalt Strike configurations in near real-time. This notebook should be treated as a "in-progress notebook" and not a guide on finding something specific across beacons. I'm creating this as a way to practice Python and Jupyter and sharing because some observations were quite interesting.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://github.com/axelarator/csbeacon_analysis"><div class="kg-bookmark-content"><div class="kg-bookmark-title">GitHub - axelarator/csbeacon_analysis</div><div class="kg-bookmark-description">Contribute to axelarator/csbeacon_analysis development by creating an account on GitHub.</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/pinned-octocat-093da3e6fa40-8.svg" alt=""><span class="kg-bookmark-author">GitHub</span><span class="kg-bookmark-publisher">axelarator</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/csbeacon_analysis" alt="" onerror="this.style.display = 'none'"></div></a></figure>

Since this site hosts well over 500 files and I'm not sure how often configs get added / updated, this notebook first checks if the filename exists or if the file itself has a newer "Last-Modified" value meaning the data within the file might've been updated. With all of the files downloaded, they're then appended into a dataframe where analysis can begin.

As of writing right now, there are 562 beacon configurations. This includes both x64 and x86 architecture.

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-1.png" class="kg-image" alt="" loading="lazy" width="662" height="156"></figure>

## Group By Listener Port

The first idea I had was to group everything by port to uncover the most common beacon listener ports.

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-2.png" class="kg-image" alt="" loading="lazy" width="702" height="156"></figure>

With 116 different ports, I didn't want to count all of them since these are malleable profiles so realistically any port could be chosen. I chose the top 25 but split them into two graphs since the "Other" column was an extreme outlier. The first graph shows the top 10 ports. The second graph is the same but for visual reasons as to why I split the "Other" column, you can see that is where a large variance lies. The third graph takes that variance and shows the top 15 ports. Since these ports are modifiable, the rest of the IPs use a unique port or at most share it with 3 other hosts (including the same IP across both architectures).

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-8.png" class="kg-image" alt="" loading="lazy" width="1998" height="1000"></figure>

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-3.png" class="kg-image" alt="" loading="lazy" width="1998" height="1982"></figure>

I should add that the results here don't group by unique IPs. The reason being beacon configs don't have a field for the "IP" but instead the "SETTING\_DOMAINS." For example, there are 6 listeners on port 9999 but when inspecting the data, there are overlapping IPs with different URIs.

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th></th><th>source_file</th><th>settings.SETTING_DOMAINS</th></tr></thead><tbody><tr><th>78</th><td>150.187.25.242-9999_x64config.json</td><td>150[.]187[.]25[.]242,/pixel,116[.]203[.]31[.]207,/j.ad</td></tr><tr><th>226</th><td>117.72.242.9-9999_x64config.json</td><td>117[.]72[.]242[.]9,/load</td></tr><tr><th>244</th><td>49.235.177.231-9999_x86config.json</td><td>49[.]235[.]177[.]231,/dpixel</td></tr><tr><th>309</th><td>150.187.25.242-9999_x86config.json</td><td>150[.]187[.]25[.]242,/en_US/all.js,116[.]203[.]31[.]207,/activity</td></tr><tr><th>426</th><td>117.72.242.9-9999_x86config.json</td><td>117[.]72[.]242[.]9,/ca</td></tr><tr><th>432</th><td>49.235.177.231-9999_x64config.json</td><td>49[.]235[.]177[.]231,/activity</td></tr></tbody></table>

Without much work already, an additional Cobalt Strike beacon has been found. In rows 78 and 309 is an IP, 116.203.31\[.\]207, which doesn't currently exist in the dataset but does exist in the ThreatFox database.

<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://threatfox.abuse.ch/ioc/1570775/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">ThreatFox | Checking your browser</div><div class="kg-bookmark-description"></div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/images/icon/favicon-5.ico" alt=""><span class="kg-bookmark-author">Checking your browser</span></div></div><div class="kg-bookmark-thumbnail"><img src="/images/thumbnail/threatfox_logo-2.svg" alt="" onerror="this.style.display = 'none'"></div></a></figure>

After this analysis, I created four additional columns in the dataframe. The first line extracts the IP, Port, and Architecture from the filename. The second line extracts the URI path from the `SETTING_DOMAINS` column. This makes it very easy to group results going forward.

```python
final_df[["ip", "port", "arch"]] = final_df["source_file"].str.extract(r"(?P<ip>[\d\.]+)-(?P<port>\d+)_(?P<arch>x\d{2})config\.json")

final_df["uri_path"] = final_df["settings.SETTING_DOMAINS"].str.split(",", n=1).str[1]
```

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th></th><th>ip</th><th>port</th><th>arch</th><th>uri_path</th></tr></thead><tbody><tr><th>0</th><td>193.37.69.43</td><td>95</td><td>x86</td><td>/updates.rss</td></tr><tr><th>1</th><td>139.196.41.201</td><td>30001</td><td>x64</td><td>/fwlink</td></tr><tr><th>2</th><td>136.115.102.225</td><td>44444</td><td>x64</td><td>/cm</td></tr><tr><th>3</th><td>179.43.186.214</td><td>80</td><td>x86</td><td>/push</td></tr><tr><th>4</th><td>154.12.36.140</td><td>80</td><td>x64</td><td>/__utm.gif</td></tr></tbody></table>

# Group By Public Key

If multiple beacons share the same public key, it's likely they're related and can be grouped together.

These 9 IPs all share the same public key and while they don't all exist under the same ASN, distribute the same file, etc. they can still be linked by a common infrastructure key.

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-4.png" class="kg-image" alt="" loading="lazy" width="2000" height="245"></figure>

Going a step further, these public keys can be grouped together to aggregate results with any other columns. In this table, I group public keys and view the number of IPs associated, how many ports are being used, number of URI paths, how many config files contain that key and the number of different Cobalt Strike versions that are used.

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th></th><th>unique_ips</th><th>unique_ports</th><th>unique_paths</th><th>configs</th><th>version</th></tr><tr><th>settings.SETTING_PUBKEY</th><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody><tr><th>640f18232741807f5bc93c7deaba8d09d302929a0e9fe5c0f877a956256df3d9</th><td>10</td><td>8</td><td>13</td><td>20</td><td>1</td></tr><tr><th>b2f0552a10f9f88e1c4efdbf9da92ed084a8d7d25b5b33820720577d75c0db23</th><td>2</td><td>4</td><td>6</td><td>8</td><td>1</td></tr><tr><th>35ad01692eecf13a1a36b5fc11bd242b8d49012517c02a82e8dc38103c02e6a3</th><td>2</td><td>3</td><td>5</td><td>6</td><td>1</td></tr><tr><th>21ff573a0cf0fcc29c9228ed22d5e364c3fe6497567ac6584a3c9455831b758e</th><td>1</td><td>3</td><td>2</td><td>6</td><td>2</td></tr><tr><th>2c6357bcc7958af1622094b71f13c071a8ff003696829f7ada5a072d799badba</th><td>3</td><td>1</td><td>1</td><td>6</td><td>2</td></tr></tbody></table>

That second to last PUBKEY is interesting because there's only one IP but two Cobalt Strike versions. I filtered down on that value and it appears the x64 beacon returns "Unknown" but the x86 version returns "Cobalt Strike 4.9 (Sep 19, 2023)"

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th></th><th>arch</th><th>ip</th><th>port</th><th>uri_path</th><th>version</th></tr></thead><tbody><tr><th>39</th><td>x86</td><td>83.229.125.47</td><td>8090</td><td>/cdn/jquery-3.6.0.js</td><td>Cobalt Strike 4.9 (Sep 19, 2023)</td></tr><tr><th>146</th><td>x64</td><td>83.229.125.47</td><td>8022</td><td>/static/jquery.min.js</td><td>Unknown</td></tr><tr><th>263</th><td>x86</td><td>83.229.125.47</td><td>8080</td><td>/static/jquery.min.js</td><td>Cobalt Strike 4.9 (Sep 19, 2023)</td></tr><tr><th>414</th><td>x64</td><td>83.229.125.47</td><td>8090</td><td>/static/jquery.min.js</td><td>Unknown</td></tr><tr><th>503</th><td>x64</td><td>83.229.125.47</td><td>8080</td><td>/cdn/jquery-3.6.0.js</td><td>Unknown</td></tr><tr><th>526</th><td>x86</td><td>83.229.125.47</td><td>8022</td><td>/static/jquery.min.js</td><td>Cobalt Strike 4.9 (Sep 19, 2023)</td></tr></tbody></table>

# Group By Watermark

When listing all unique watermarks, there were only 15.

<figure class="kg-card kg-image-card"><img src="/images/2025/12/image-5.png" class="kg-image" alt="" loading="lazy" width="1268" height="936"></figure>

Taking the user-agent string from watermark 6, a [Censys query](https://platform.censys.io/search?q=%28host.services.endpoints.cobalt_strike.x64.user_agent%3D%22Mozilla%2F5.0+%28compatible%3B+MSIE+9.0%3B+Windows+NT+6.1%3B+WOW64%3B+Trident%2F5.0%3B+BOIE9%3BENCA%29%22+OR+host.services.endpoints.cobalt_strike.x86.user_agent%3D%22Mozilla%2F5.0+%28compatible%3B+MSIE+9.0%3B+Windows+NT+6.1%3B+WOW64%3B+Trident%2F5.0%3B+BOIE9%3BENCA%29%22%29+and+host.ip%3A+*&org=31a7bac9-0070-4e2e-bbb2-c94d335a7c0f) can be built to find what else might be using the same user-agent.

`Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; MALC)`

*   8.137.149\[.\]67
*   120.79.229\[.\]151
*   115.120.245\[.\]134

Hunt.io wrote about another [unique watermark](https://hunt.io/blog/rare-watermark-links-cobalt-strike-team-servers-to-ongoing-suspicious-activity) (688983459) being used by just 7 IPs. Although the dataset I'm looking at includes version 4.10, I did not observe that specific watermark.

```
version                              settings.SETTING_WATERMARK
Cobalt Strike 4.9 (Sep 19, 2023)     987654321                     145
                                     666666666                     131
Cobalt Strike 4.8 (Feb 28, 2023)     987654321                     130
Cobalt Strike 4.7 (Aug 17, 2022)     391144938                      32
Unknown                              100000                         21
Cobalt Strike 4.5 (Dec 14, 2021)     100000                         21
Cobalt Strike 4.7 (Aug 17, 2022)     987654321                      14
Unknown                              987654321                       7
Cobalt Strike 4.3 (Mar 03, 2021)     426352781                       6
Unknown                              1234567890                      5
Cobalt Strike 4.4 (Aug 04, 2021)     1234567890                      5
Unknown                              305419896                       4
Cobalt Strike 4.0 (Dec 05, 2019)     305419896                       4
Cobalt Strike 4.3 (Mar 03, 2021)     1234567890                      4
Cobalt Strike 4.5 (Dec 14, 2021)     666666                          3
Cobalt Strike 4.2 (Nov 06, 2020)     1359593325                      3
Unknown                              666666                          3
                                     1359593325                      3
                                     1                               2
Cobalt Strike 4.4 (Aug 04, 2021)     785920802                       2
Cobalt Strike 4.5 (Dec 14, 2021)     11111                           2
Cobalt Strike 4.1 (Jun 25, 2020)     388888888                       2
Unknown                              318104477                       2
                                     388888888                       2
                                     785920802                       2
Cobalt Strike 4.2 (Nov 06, 2020)     1                               2
Cobalt Strike 4.10.1 (Dec 10, 2024)  318104477                       2
Cobalt Strike 4.4 (Aug 04, 2021)     6                               1
Unknown                              6                               1
                                     666666666                       1
```

Another way of using this data is to take the existing watermarks and develop another [Censys query](https://platform.censys.io/search?q=host.services.endpoints.cobalt_strike.x64.watermark%3D%7B987654321%2C391144938%2C1234567890%2C666666666%2C426352781%2C100000%2C++305419896%2C1359593325%2C388888888%2C666666%2C1%2C785920802%2C318104477%2C6%2C11111%7D+OR+host.services.endpoints.cobalt_strike.x86.watermark%3D%7B987654321%2C391144938%2C1234567890%2C666666666%2C426352781%2C100000%2C++305419896%2C1359593325%2C388888888%2C666666%2C1%2C785920802%2C318104477%2C6%2C11111%7D&org=31a7bac9-0070-4e2e-bbb2-c94d335a7c0f) for proactive monitoring. Right now this query returns 189 results which is a great start.

# Comparing Architecture

With both x86 and x64 config files available along with single IPs using multiple ports, I thought it'd be interesting to see what's different between them. A second dataframe was created that split columns based on architecture so that differences could be easily denoted by \_x64 or \_x86 at the end of each column name.

Taking an IP that uses multiple ports, it's much easier to pull every URI path and SPAWNTO process.

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th></th><th>ip</th><th>port</th><th>uri_path_x86</th><th>uri_path_x64</th><th>settings.SETTING_SPAWNTO_X86_x86</th><th>settings.SETTING_SPAWNTO_X64_x64</th></tr></thead><tbody><tr><th>281</th><td>83.229.125.47</td><td>8022</td><td>/static/jquery.min.js</td><td>/static/jquery.min.js</td><td>%windir%\syswow64\werfault.exe</td><td>%windir%\sysnative\werfault.exe</td></tr><tr><th>282</th><td>83.229.125.47</td><td>8080</td><td>/static/jquery.min.js</td><td>/cdn/jquery-3.6.0.js</td><td>%windir%\syswow64\werfault.exe</td><td>%windir%\sysnative\werfault.exe</td></tr><tr><th>283</th><td>83.229.125.47</td><td>8090</td><td>/cdn/jquery-3.6.0.js</td><td>/static/jquery.min.js</td><td>%windir%\syswow64\werfault.exe</td><td>%windir%\sysnative\werfault.exe</td></tr></tbody></table>

This can also be useful to find differences in a certain column. Taking user-agent strings as an example, some strings are more common in x64 beacons than they are in x86.

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th>arch</th><th>x64_ips</th><th>x86_ips</th><th>ip_diff</th></tr><tr><th>settings.SETTING_USERAGENT</th><th></th><th></th><th></th></tr></thead><tbody><tr><th>Mozilla/5.0 (iPhone; CPU iPhone OS 12_1_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16C104</th><td>8</td><td>8</td><td>0</td></tr><tr><th>Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; Trident/4.0)</th><td>7</td><td>4</td><td>3</td></tr><tr><th>Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; yie9)</th><td>7</td><td>3</td><td>4</td></tr><tr><th>Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; NP06)</th><td>6</td><td>3</td><td>3</td></tr><tr><th>Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; WOW64; Trident/4.0; SLCC2; .NET CLR 2.0.50727)</th><td>6</td><td>5</td><td>1</td></tr></tbody></table>

These top five user-agents that are more common in x86 beacons.

<table border="1" class="dataframe"><thead><tr style="text-align: right;"><th>arch</th><th>x64_ips</th><th>x86_ips</th><th>ip_diff</th></tr><tr><th>settings.SETTING_USERAGENT</th><th></th><th></th><th></th></tr></thead><tbody><tr><th>Mozilla/5.0 (iPhone; CPU iPhone OS 12_1_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16C104</th><td>8</td><td>8</td><td>0</td></tr><tr><th>Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.0; Trident/5.0)</th><td>4</td><td>7</td><td>-3</td></tr><tr><th>Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; MANM)</th><td>3</td><td>6</td><td>-3</td></tr><tr><th>Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)</th><td>3</td><td>6</td><td>-3</td></tr><tr><th>Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)</th><td>3</td><td>5</td><td>-2</td></tr></tbody></table>

# Conclusion

Malleable C2 profiles introduce a wide range of possibilities for disguising C2 traffic, making beacon tracking significantly more challenging. Critical indicators often reside within the configuration file itself and if the host has gone stale, that configuration won't be recoverable. This living dataset of configuration files eases the analysis of beacon behavior without relying solely on post-incident artifacts. Since this data is collected independently of individual incidents, it remains largely unbiased and provides a clearer view of real-time Cobalt Strike activity.
