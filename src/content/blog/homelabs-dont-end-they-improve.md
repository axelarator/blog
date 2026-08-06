---
title: "Homelabs Don't End, They Improve"
description: "There's a never ending list of homelab projects, ways to build one, hardware requirements, goals for running one, single server or 24U rack, the list goes on."
pubDate: 2025-10-29T21:53:00.000-06:00
heroImage: "/images/2025/10/000660220008.jpg"
heroImageCaption: "Cinestill 800T film"
tags: []
---

There's a never ending list of homelab projects, ways to build one, hardware requirements, goals for running one, single server or 24U rack, the list goes on.

I started my journey long ago when I thought VirtualBox and an external HDD was all I needed. Fast forward to now and I run two dedicated servers hogging my office.

*   Unraid stores 28 terabytes of "Linux ISOs", this blog, and my photos.
*   Proxmox runs my training lab I use to maintain threat hunting skills and continuous development in areas like malware development.

The topic of this post will be Proxmox as I find it more applicable to this blog.

I recently completed the [Red Team Operations](https://specterops.io/training/red-team-operations/) course by SpecterOps. Take it if you can because it was the single best hands-on offensive training I've had. Mythic C2, enumeration, priv esc, lateral movement, Windows concepts beyond my comprehension, and staying below the SOC radar. During that course, the instructors talked about how they use Ludus for building ranges. That peaked my interest because in my years of using Proxmox, I had only every manually configured my VMs and if you've ever setup your own Windows Server DC or SIEM, you know doing that multiple times gets tiring fast. Ludus even shares that same sentiment on the homepage of their documentation:

<figure class="kg-card kg-image-card"><img src="/images/2025/10/image-16.png" class="kg-image" alt="" loading="lazy" width="1194" height="338"></figure>

So what is Ludus?

# Ludus

To not rewrite their [documentation](https://docs.ludus.cloud/docs/intro)...

> Ludus is a system to build easy to use cyber environments, or "ranges" for testing and development.  
> Built on Proxmox, Ludus enables advanced automation while still allowing easy manual modifications or setup of virtual machines and networks.  
> Ludus is implemented as a server that runs Packer and Ansible to create templates and deploy complex cyber environments from a single configuration file.

What this allows us to do is build out a config file of pre-built templates, some Ansible roles, and maybe some additional tools if we want. Below is my configuration to stand up a malware analysis machine, a victim box to execute malware on, and Kali because how do you not have Kali on a security focused homelab?

```
ludus:
  - vm_name: "{{ range_id }}-flare"
    hostname: "{{ range_id }}-FLARE"
    template: flare-vm-template
    vlan: 99
    ip_last_octet: 4
    ram_gb: 8
    cpus: 4
    windows:
      install_additional_tools: false
    roles:
      - badsectorlabs.ludus_flarevm
  - vm_name: "{{ range_id }}-win11-22h2-enterprise-x64-1"
    hostname: "{{ range_id }}-WIN11-22H2-1"
    template: win11-22h2-x64-enterprise-template
    vlan: 10
    ip_last_octet: 21
    ram_gb: 8
    cpus: 4
    windows:
      install_additional_tools: true
      office_version: 2019
      office_arch: 64bit
  - vm_name: "{{ range_id }}-kali"
    hostname: "{{ range_id }}-kali"
    template: kali-x64-desktop-template
    vlan: 99
    ip_last_octet: 1
    ram_gb: 8
    cpus: 4
    linux: true
    testing:
      snapshot: false
      block_internet: false
network:
  inter_vlan_default: REJECT
  rules:
    - name: Only allow windows to kali on 443
      vlan_src: 10
      vlan_dst: 99
      protocol: tcp
      ports: 443
      action: ACCEPT
    - name: Only allow windows to kali on 80
      vlan_src: 10
      vlan_dst: 99
      protocol: tcp
      ports: 80
      action: ACCEPT
    - name: Only allow windows to kali on 8080
      vlan_src: 10
      vlan_dst: 99
      protocol: tcp
      ports: 8080
      action: ACCEPT
    - name: Allow kali to all windows
      vlan_src: 99
      vlan_dst: 10
      protocol: all
      ports: all
      action: ACCEPT
```

That's it. In maybe less than an hour depending on network and system resources, FlareVM, Windows 11, and Kali are up and running in their defined networks with custom firewall rules. The firewall rules need work for real hardening but when I said "executing malware", I'm referring to injecting my own shellcode into a standard process, not something like a [Qakbot sample](/qakbot-distributes-msi-files/) where I risk serious impact.

<figure class="kg-card kg-image-card"><img src="/images/2025/10/image-17.png" class="kg-image" alt="" loading="lazy" width="501" height="498"></figure>

## Configurations

I'll get to the details next but Ludus supports an incredible amount of customization that goes beyond just a few VMs and you don't have to limit yourself to a single range. The one above is a good default for if I need a Windows box to check something or practice malware analysis with Flare. If you really want to see the full capabilities of Ludus, check out the [environment guides](https://docs.ludus.cloud/docs/category/environment-guides) for a (not complete) list of range ideas. One that isn't in the list is [ConstructingDefense](https://github.com/Antonlovesdnb/ConstructingDefenseLab) which is my go-to analysis environment and saves literal days of configuration for something that only needs to be built once and again maybe takes an hour or two to fully "construct."

# So how do you use it?

Ludus can be deployed in Azure, bare metal, GCP, Hyper-V, Proxmox, and VMware Fusion. The recommended approach with minimal headaches is bare metal Proxmox though and it's how I configured my lab (twice).

I have it running on an Intel NUC with the following hardware:

*   16-core i7-1360P
*   64Gb RAM
*   1TB of storage
*   1 NIC

The first time I installed Ludus, I installed it on an existing Proxmox node within a Debian VM. What I didn't realize when installing is that within Debian, it installs an entirely separate Proxmox node. That means my main Proxmox node still ran but if I went to my browser and typed in https://<Ludus IP>:8006/ then I would access ANOTHER Proxmox node. I didn't notice performance drops and it's actually not a big deal if you go that route since it's an option in their [docs](https://docs.ludus.cloud/docs/deployment-options/proxmox/). That setup is unnecessary for me though but still worth pointing out because now we'll focus on how to actually install and use Ludus the recommended way.

## Install

I'll just focus on the main points as to not rewrite their documentation. It's very detailed and I'd highly recommend reading through all of it. RTFM.

The proper way to install Ludus is to get a dedicated system in which you'll install Debian 12/13. Just remember to not install a desktop environment and only an SSH server since all management going forward will be handled through the CLI or Proxmox UI.

Once Debian is installed, run these commands from a remote device.

```
ssh <user>@<debian IP>
apt update && apt install curl sudo git ca-certificates python3-debian
curl -s https://ludus.cloud/install | bash
```

Your terminal will now walk you through setup configurations. Customize if you need to but defaults are fine.

## Create a User

Users are how you separate ranges in Ludus as they each have their own API key. These are separate than the user you created when first installing Debian.

The first step though is to save your Root API key in order to manage users. Make sure you're logged in as root:

```
# if not root
sudo su -
# otherwise
ludus-install-status
LUDUS_API_KEY='<api key from last command output>'
ludus user add --name "Axela Rator" --userid "ax" --admin --url https://127.0.0.1:8081
```

Great! A user was created and an API key was provided. Save that.

A great thing about users in Ludus is you don't have to constantly logout/login executing tasks as a user. Simply run _export LUDUS\_API\_KEY='<api key>'_ for any user you want to run range commands as. This is important when you want to create multiple ranges but not have them managed all under one user. Create as many users as you want and then deploy each range under a separate user.

# Templates, Roles, Configs

## Templates

In order to build a range, you first have to have templates installed to build ranges from. Packer helps with this. If you've ever built a VM from scratch before, you know you have to download an ISO, configure your VM to boot from it, set hardware configurations, boot VM, and set it up like a fresh computer. That takes time and gets repetitive if you have a large range. Packer automates all of this by downloading an ISO and using a pre-built template to automate the entire process. These only need to be done once per OS version meaning you can install a Windows 11 22H2 template once and then that template can be used to create as many Windows 11 22H2 VMs as you want. For my main user, I have these templates installed.

```bash
ludus@ludus:~$ ludus templates list
+------------------------------------+-------+
|              TEMPLATE              | BUILT |
+------------------------------------+-------+
| debian-11-x64-server-template      | TRUE  |
| debian-12-x64-server-template      | TRUE  |
| kali-x64-desktop-template          | TRUE  |
| win11-22h2-x64-enterprise-template | TRUE  |
| win2022-server-x64-template        | TRUE  |
| ubuntu-22.04-x64-server-template   | TRUE  |
| ubuntu-24.04-x64-server-template   | TRUE  |
| win10-22h2-x64-enterprise-template | TRUE  |
| win2019-server-x64-template        | TRUE  |
| flare-vm-template                  | TRUE  |
| win11-23h2-x64-enterprise-template | TRUE  |
+------------------------------------+-------+
```

Ludus comes with a preset list of templates you can install but if you want more options like the Flare-VM template or various Windows Server/Desktop templates, then clone this repo and add any extras.

```bash
git clone https://gitlab.com/badsectorlabs/ludus
cd ludus/templates
ls
ludus templates add -d <any template from the list>
ludus templates build
ludus templates logs -f
```

This will take some time. Go touch grass.

## Roles

Alright so the templates are installed but we can't use them yet. They're templates, not VMs.

Ludus relies on Ansible for deploying ranges and not just specific Ansible roles built for Ludus but the _entire_ Ansible Galaxy. Roles aren't immediately required but lets say you use my config at the beginning and think "I love Elastic and want to view logs there. Now I have to manually setup an ELK stack ☹️"

WRONG

```bash
ludus ansible roles add badsectorlabs.ludus_elastic_container --user <your user>
ludus ansible roles add badsectorlabs.ludus_elastic_agent --user <your user>

# add this to your config
- vm_name: "{{ range_id }}-elastic"
    hostname: "{{ range_id }}-elastic"
    template: debian-12-x64-server-template
    vlan: 20
    ip_last_octet: 1
    ram_gb: 8
    cpus: 4
    linux: true
    testing:
      snapshot: false
      block_internet: false
    roles:
      - badsectorlabs.ludus_elastic_container
    role_vars:
      ludus_elastic_password: "thisisapassword"
# For any VM you want an Elastic agent on
roles:
      - badsectorlabs.ludus_elastic_agent

##### For Example #####
- vm_name: "{{ range_id }}-win11-22h2-enterprise-x64-1"
    hostname: "{{ range_id }}-WIN11-22H2-1"
    template: win11-22h2-x64-enterprise-template
    vlan: 10
    ip_last_octet: 21
    ram_gb: 8
    cpus: 4
    windows:
      install_additional_tools: false
    roles:
      - badsectorlabs.ludus_elastic_agent
```

That's it. Your range now has an Elastic server and VMs are added as agents.

Another good one is adding ADCS to a Windows Server which add 12 certificate templates.

```
# install the role for your user
ludus ansible roles add badsectorlabs.ludus_adcs

# add the role to your Windows Server config
ludus:
  - vm_name: "{{ range_id }}-ad-dc-win2022-server-x64-1"
    hostname: "{{ range_id }}-DC01-2022"
    template: win2022-server-x64-template
    vlan: 10
    ip_last_octet: 11
    ram_gb: 6
    cpus: 4
    windows:
      sysprep: true
    domain:
      fqdn: ludus.domain
      role: primary-dc
# right here
    roles:
      - badsectorlabs.ludus_adcs
```

## Configs

Regardless of what roles are required (if any), you now have a full config to use for deployment. Set the config, deploy the range, tail the output, watch for logs, hope it doesn't error and you're good to go!

```bash
ludus range config set -f <your config>.yml
ludus range deploy
ludus range logs -f
```

Errors are important to look for. Sometimes it's formatting, sometimes the VM couldn't deploy properly, maybe a network issue. My advice is start simple. Don't try and architect a 5 VM lab with ADCS, 2 forests, Elastic, and two VLANs. The beauty of all of this is with that config file, you can destroy and entire range and rebuild it in a short amount of time.

These configs can be as simple or as complex as you want when paired with firewall rules and Ansible roles which makes Ludus a great option for building a range suitable for any need in a matter of hours.

# Conclusion

I didn't want this to be a full guide on Ludus and I barely even covered half of what it's capable of. Again, their documentation is incredibly in depth and their Discord is even more helpful. I wanted to illustrate just how fast and simple it is to stand up an entire range complete with network segmentation, maybe a SIEM, and a full Windows environment to practice any attack vector or research specific Windows internals.

You just need spare hardware, Proxmox, and a YAML config to orchestrate a security lab of your choice.

Have fun and happy hunting.
