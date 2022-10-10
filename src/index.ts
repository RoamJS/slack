import runExtension from "roamjs-components/util/runExtension";
import React from "react";
import OauthPanel from "roamjs-components/components/OauthPanel";
import apiPost from "roamjs-components/util/apiPost";
import Slack from "./Slack_Mark.svg";
import {
  getAliases,
  render,
} from "./components/SlackOverlay";
import createHashtagObserver from "roamjs-components/dom/createHashtagObserver";
import getUids from "roamjs-components/dom/getUids";

export default runExtension({
  run: (args) => {
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
                    `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=channels:read,chat:write,users:read,users:read.email&user_scope=chat:write&redirect_uri=https://roamjs.com/oauth?auth=true`
                  ),
                getAuthData: (data: string) =>
                  apiPost({
                    anonymous: true,
                    path: "slack-url",
                    data: {
                      ...JSON.parse(data),
                      redirect_uri: "https://roamjs.com/oauth?auth=true",
                    },
                  }),
                ServiceIcon: Slack,
              }),
          },
        },
        {
          id: "user-format",
          name: "User Format",
          description: "The format tags should be in to be detected as eligible users to message in Slack",
          action: {type: "input", placeholder: "@{username}"}
        },
        {
          id: "channel-format",
          name: "Channel Format",
          description: "The format tags should be in to be detected as eligible channels to message in Slack",
          action: {type: "input", placeholder: "#{channel}"}
        }
      ],
    });
    createHashtagObserver({
      attribute: "data-roamjs-slack-overlay",
      callback: (s: HTMLSpanElement) => {
        const userFormat = args.extensionAPI.settings.get(
          "user-format"
        ) as string;
        const channelFormat = args.extensionAPI.settings.get("channel-format");
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
        const aliasKeys = new Set(Object.keys(getAliases()));
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
