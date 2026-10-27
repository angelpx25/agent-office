# Configuration

Back to the [README](../README.md).

## Where the office keeps things

The office keeps its data in `~/agent-office` (`--home` or `AGENT_OFFICE_HOME` to move it) and clones projects next to it, as `~/agent-office/<owner>/<repo>`. To clone them somewhere else, like `~/Workspace`, an admin picks the **Workspace folder** in ⚙️ Settings → **🏢 Building** (or start with `--projects` or `AGENT_OFFICE_PROJECTS`). Floors you already have stay where they are, and a checkout of the same repository that's already in the new folder is used as it is. The building's map is in `~/agent-office/.agent-office/map.json`, and maps of your own go in `~/agent-office/.agent-office/maps/` (see [Maps](maps.md)). The list of floors is `~/agent-office/.agent-office/floors.json`, and each account's own Claude and GitHub sign-ins are in `~/agent-office/.agent-office/homes/<account>/` (revoking the account deletes them). Each floor keeps its workers, queue, pictures and worktrees in its own checkout's `.agent-office/`.

Already have a checkout? Pick its repository anyway: a checkout of it that's already where the workspace folder would clone it is used as it is. You can still start the office in a project, `agent-office ~/code/my-project`: that project becomes a floor, and the office keeps its data in `~/code/my-project/.agent-office` as it did before there were floors. An office that already ran in a project carries on in it when you start `agent-office` there again. An admin can take that project off the building in the elevator like any other floor.

## Command line

```
agent-office [dir] [options]

      --home <dir>        Where the office keeps its data without a [dir] (default ~/agent-office)
      --projects <dir>    Where new floors are cloned, as <dir>/<owner>/<repo> (default ~/agent-office;
                          also settable from ⚙️ Settings)
  -p, --port <n>          Port (default 4600, env PORT)
  -H, --host <addr>       Bind address (default 127.0.0.1; 0.0.0.0 lets your network in)
      --password <pw>     Office password (env AGENT_OFFICE_PASSWORD)
      --no-open           Don't open the office in your browser when it starts
      --agent <cmd>       Default agent command (default "claude")
      --agent-args <str>  Extra args for the configured agent, e.g. "--model opus"
      --dsh-profile <n>   DeepSeek Harness profile over ACP (default "acp")
      --tls-cert <file>   Serve HTTPS with this cert…
      --tls-key <file>    …and key
      --self-signed       Serve HTTPS with a generated self-signed cert
      --trust-proxy       Trust X-Forwarded-* (behind Caddy/nginx)
      --integrations      Open the API for outside automation on 127.0.0.1:5690 (see below)
      --integration-port <n>  ...on this port instead (env AGENT_OFFICE_INTEGRATION_PORT)
      --integration-name <s>  Who its prompts are from in the office (default "n8n", env AGENT_OFFICE_INTEGRATION_NAME)
      --turn <url>        Add a TURN server for voice, e.g. turn:user:pass@host:3478
                          (env AGENT_OFFICE_TURN, several separated by spaces)
      --budget <usd>      Daily tracked Claude Code budget (OpenCode/Codex/Grok/Muse/DSH excluded)
      --budget-pause      ...and nobody can hire a new worker until the next day
      --max-workers <n>   Run at most n workers at once, across every floor (env AGENT_OFFICE_MAX_WORKERS)
      --webhook <url>     Post to this Slack / Discord webhook when a worker needs input or finishes
      --city <name>       Put the office in a real city: its sun and live weather (open-meteo.com)
      --weather <kind>    Pin the weather: clear, cloudy, rain, storm, snow or fog
      --real-time-sky     Start the sky on the real clock, not a day an hour (env AGENT_OFFICE_SKY_CLOCK=real; ⚙️ Settings can switch it)

agent-office setup [--projects <dir>] [--project <owner/repo>]... [--home <dir>]

  The first-start walkthrough again: the workspace folder, GitHub sign-in and
  repositories to clone as floors. With --projects / --project it asks nothing.
  Run it while the office is stopped.

agent-office prune [dir] [-n|--dry-run] [-f|--force]

  Removes leftover worker worktrees under .agent-office/worktrees/ and their
  office/* branches, in one floor's checkout (dir). Anything with uncommitted changes or unpushed commits is
  kept unless --force is given. A worker across several projects has worktrees of them in its
  own floor's workspace: prune each project to clear those out.

agent-office accounts [list | invite [name] [--admin] | revoke <name> | role <name> admin|member | password on|off] [-d <dir>]

  Invite, list and revoke people's own accounts, and switch the shared password
  off or on. Works while the office runs.

agent-office tunnel [office@address | url] [--port <n>] [--office-port <n>] [--name <name>] [--password <pw>] [--no-open] [--insecure] [-- <ssh options>]

  On your own computer, for an office that runs somewhere else: every web server
  a worker starts there opens on the same port here, by itself, and closes when
  the worker stops it. Given an SSH address it opens the tunnel to the office too.
  See docs/tunnel.md.
```

## Outside automation (n8n)

Automation running on the office's own machine, like n8n or a cron job, can list a floor's workers and tell one of them something. Start the office with `--integrations` (or `--integration-port <n>`, or `AGENT_OFFICE_INTEGRATION_PORT`) and it opens a small API on `127.0.0.1:5690`. That's loopback only: it's never on the office's own port, so nothing outside the machine, or coming in through a proxy like Cloudflare, can reach it.

It takes a token of its own, not any worker's. The office makes one the first time and keeps it in `<home>/.agent-office/integrations.json` (only the office's user can read it; with the default home that's `~/agent-office/.agent-office/integrations.json`). Set `AGENT_OFFICE_INTEGRATION_TOKEN` to use one of your own instead. The token isn't printed in the log or sent back in any answer. Delete the file and restart the office for a new one.

```bash
TOKEN=$(jq -r .token ~/agent-office/.agent-office/integrations.json)

# A floor's workers: the same rows as office-workers list. Without ?floor= it's the first floor;
# a floor is named by its id, name or owner/repo, and the answer lists every floor.
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5690/integrations/workers?floor=acme/app"

# Tell a worker something. A worker that's stopped or asleep wakes up with it as its next message.
curl -s -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"floor": "acme/app", "worker": "Mochi", "prompt": "Rebase on main and rerun the tests"}' \
  http://127.0.0.1:5690/integrations/tell
```

`POST /integrations/tell` takes `worker` (a name or id), `prompt` (up to 20,000 characters) and an optional `floor`. It only talks to agents, never to a shell, which would run the prompt as a command. The office shows the prompt as coming from `n8n` (`--integration-name` to call it something else), and everyone on the floor gets a toast saying so. The API can't hire anyone or send anyone home. A wrong or missing token gets a 401, it answers 60 requests a minute in all (429 after that), and a request body can be up to 256 KB.

