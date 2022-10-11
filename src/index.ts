import runExtension from "roamjs-components/util/runExtension";
import React from "react";
import OauthPanel from "roamjs-components/components/OauthPanel";
import apiPost from "roamjs-components/util/apiPost";
import Slack from "./Slack_Mark.svg";
import { getAliases, render } from "./components/SlackOverlay";
import createHashtagObserver from "roamjs-components/dom/createHashtagObserver";
import getUids from "roamjs-components/dom/getUids";
import migrateLegacySettings from "roamjs-components/util/migrateLegacySettings";

export default runExtension({
  run: (args) => {
    migrateLegacySettings({
      extensionAPI: args.extensionAPI,
      specialKeys: {
        aliases: (n) => [{ key: "aliases", value: n.uid }],
      },
    });
    args.extensionAPI.settings.panel.create({
      tabTitle: "Slack",
      settings: [
        {
          id: "oauth",
          name: "Log In",
          description: "Log into Slack to connect to your account within Roam!",
          action: {
            type: "reactComponent",
            component: () =>
              React.createElement(OauthPanel, {
                service: "slack",
                getPopoutUrl: () =>
                  Promise.resolve(
                    `https://slack.com/oauth/v2/authorize?client_id=768085626834.1680821489381&scope=channels:read,chat:write,users:read,users:read.email&user_scope=chat:write&redirect_uri=https://roamjs.com/oauth?auth=true`
                  ),
                getAuthData: (data: string) =>
                  apiPost({
                    anonymous: true,
                    path: "slack-url",
                    data: {
                      ...JSON.parse(data),
                      redirect_uri: "https://roamjs.com/oauth?auth=true",
                    },
                    domain: "https://lambda.roamjs.com",
                  }),
                ServiceIcon: Slack,
              }),
          },
        },
        {
          id: "user-format",
          name: "User Format",
          description:
            "The format tags should be in to be detected as eligible users to message in Slack",
          action: { type: "input", placeholder: "@{username}" },
        },
        {
          id: "channel-format",
          name: "Channel Format",
          description:
            "The format tags should be in to be detected as eligible channels to message in Slack",
          action: { type: "input", placeholder: "#{channel}" },
        },
        {
          id: "aliases",
          name: "Aliases",
          description:
            "The block reference pointing to the list of aliases you have configured",
          action: { type: "input", placeholder: "((abcdefghi))" },
        },
        {
          id: "content-format",
          name: "Content Format",
          description:
            "The format that Roam will use to send the message to Slack",
          action: { type: "input", placeholder: "{block}" },
        },
      ],
    });
    createHashtagObserver({
      attribute: "data-roamjs-slack-overlay",
      callback: (s: HTMLSpanElement) => {
        const userFormat =
          args.extensionAPI.settings.get("user-format") || "@{username}";
        const channelFormat = args.extensionAPI.settings.get("channel-format") || "#{channel}";
        const userFormatRegex =
          typeof userFormat === "string"
            ? new RegExp(
                userFormat.replace(/{real name}|{username}/, "(.*)"),
                "i"
              )
            : /$^/;
        const channelFormatRegex =
          typeof channelFormat === "string"
            ? new RegExp(channelFormat.replace(/{channel}/, "(.*)"), "i")
            : /$^/;
        const aliasKeys = new Set(Object.keys(getAliases(args)));
        const r = s.getAttribute("data-tag");
        if (
          aliasKeys.size
            ? aliasKeys.has(r) ||
              (!userFormat && userFormatRegex.test(r)) ||
              (!channelFormat && channelFormatRegex.test(r))
            : userFormatRegex.test(r) || channelFormatRegex.test(r)
        ) {
          const container = s.closest(".roam-block") as HTMLDivElement;
          if (container) {
            const { blockUid } = getUids(container);
            const newSpan = document.createElement("span");
            newSpan.style.verticalAlign = "middle";
            newSpan.onmousedown = (e: MouseEvent) => e.stopPropagation();
            s.appendChild(newSpan);
            render({
              parent: newSpan,
              tag: r,
              blockUid,
              args,
            });
          }
        }
      },
    });
  },
});
