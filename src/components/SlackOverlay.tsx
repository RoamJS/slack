import {
  Button,
  Checkbox,
  Icon,
  Popover,
  Spinner,
  Text,
} from "@blueprintjs/core";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import Slack from "../Slack_Mark.svg";
import getOauth from "roamjs-components/util/getOauth";
import { useOauthAccounts } from "roamjs-components/components/OauthSelect";
import { OnloadArgs, RoamBasicNode } from "roamjs-components/types/native";
import resolveRefs from "roamjs-components/dom/resolveRefs";
import extractRef from "roamjs-components/util/extractRef";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getEditedUserEmailByBlockUid from "roamjs-components/queries/getEditedUserEmailByBlockUid";
import getDisplayNameByEmail from "roamjs-components/queries/getDisplayNameByEmail";
import getParentTextByBlockUid from "roamjs-components/queries/getParentTextByBlockUid";
import getParentTextByBlockUidAndTag from "roamjs-components/queries/getParentTextByBlockUidAndTag";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import apiPost from "roamjs-components/util/apiPost";
import apiGet from "roamjs-components/util/apiGet";

type ContentProps = {
  tag: string;
  blockUid: string;
  args: OnloadArgs;
};

type SlackMember = {
  real_name: string;
  id: string;
  name: string;
  profile: { email: string; display_name?: string };
};

type SlackChannel = {
  id: string;
  name: string;
};

const aliasRegex = new RegExp(`\\[([^\\]]*)\\]\\(([^\\)]*)\\)`, "g");

const toName = (s: SlackMember) => s.profile.display_name || s.name;

const getSettingMapFromTree = ({
  tree,
  key,
  defaultValue = {},
}: {
  tree: RoamBasicNode[];
  key: string;
  defaultValue?: { [key: string]: string };
}) => {
  const node = tree.find((s) => new RegExp(key, "i").test(s.text.trim()));
  const value = node
    ? Object.fromEntries(
        node.children.map((s) => [s.text.trim(), s.children[0].text.trim()])
      )
    : defaultValue;
  return value;
};

export const getAliases = (args: OnloadArgs): { [key: string]: string } => {
  const aliases = args.extensionAPI.settings.get("aliases");
  if (typeof aliases !== "string") return {};
  return Object.fromEntries(
    getBasicTreeByParentUid(extractRef(aliases)).map((t) => [
      t.text,
      t.children[0]?.text,
    ])
  );
};

const getCurrentUserEmail = () => {
  const globalAppState = JSON.parse(
    localStorage.getItem("globalAppState") || '["","",[]]'
  ) as (string | string[])[];
  const userIndex = globalAppState.findIndex((s) => s === "~:user");
  if (userIndex > 0) {
    const userArray = globalAppState[userIndex + 1] as string[];
    const emailIndex = userArray.findIndex((s) => s === "~:email");
    if (emailIndex > 0) {
      return userArray[emailIndex + 1];
    }
  }
  return "";
};

const getUsers = async (token: string) => {
  const userSet = new Set<SlackMember>();
  let done = false;
  let cursor: string = undefined;
  while (!done) {
    const response = await apiGet<
      | {
          members: SlackMember[];
          response_metadata: { next_cursor?: string };

          ok: true;
        }
      | { ok: false; error: string }
    >({
      domain: "https://slack.com/api",
      path: `users.list`,
      anonymous: true,
      data: cursor ? { cursor, token } : { token },
    });
    if (response.ok == false) return Promise.reject(new Error(response.error));
    (response.members || []).forEach((m) => userSet.add(m));
    cursor = response.response_metadata?.next_cursor;
    done = !cursor;
  }
  return Array.from(userSet);
};

const getChannels = async (token: string) => {
  const channelSet = new Set<SlackChannel>();
  let done = false;
  let cursor: string = undefined;
  while (!done) {
    const response = await apiGet<
      | {
          channels: SlackChannel[];
          response_metadata: { next_cursor?: string };
          ok: true;
        }
      | { ok: false; error: string }
    >({
      domain: "https://slack.com/api",
      path: "conversations.list",
      anonymous: true,
      data: cursor ? { cursor, token } : { token },
    });
    if (response.ok == false) return Promise.reject(new Error(response.error));
    (response.channels || []).forEach((c) => channelSet.add(c));
    cursor = response.response_metadata?.next_cursor;
    done = !cursor;
  }
  return Array.from(channelSet);
};

const SlackContent: React.FunctionComponent<
  ContentProps & { close: () => void }
> = ({ tag, close, blockUid, args }) => {
  const message = getTextByBlockUid(blockUid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [asUser, setAsUser] = useState(false);
  const onAsUserChanged = useCallback(
    (e: React.FormEvent<HTMLInputElement>) =>
      setAsUser((e.target as HTMLInputElement).checked),
    [setAsUser]
  );
  const { accountLabel, accountDropdown } = useOauthAccounts("slack");
  const onClick = useCallback(() => {
    setLoading(true);
    setError("");
    const tree = getFullTreeByParentUid(
      getPageUidByPageTitle("roam/js/slack")
    ).children;
    const oauth = getOauth("slack", accountLabel);
    const { token, user_token } = JSON.parse(oauth);
    const userFormat =
      args.extensionAPI.settings.get("user-format") || "@{username}";
    const channelFormat =
      args.extensionAPI.settings.get("channel-format") || "#{channel}";
    const aliases = getAliases(args);
    const aliasedName = aliases[tag]?.toUpperCase?.();
    const realNameRegex =
      typeof userFormat === "string"
        ? new RegExp(userFormat.replace("{real name}", "(.*)"), "i")
        : /$^/;
    const usernameRegex =
      typeof userFormat === "string"
        ? new RegExp(userFormat.replace("{username}", "(.*)"), "i")
        : /$^/;
    const channelRegex =
      typeof channelFormat === "string"
        ? new RegExp(channelFormat.replace("{channel}", "(.*)"), "i")
        : /$^/;
    const findFunction = realNameRegex.test(tag)
      ? (m: SlackMember) =>
          m.real_name?.toUpperCase?.() ===
          tag.match(realNameRegex)[1]?.toUpperCase?.()
      : usernameRegex.test(tag)
      ? (m: SlackMember) =>
          toName(m)?.toUpperCase() ===
          tag.match(usernameRegex)[1]?.toUpperCase()
      : () => false;
    const channelFindFunction = channelRegex.test(tag)
      ? (c: SlackChannel) =>
          c.name.toUpperCase() === tag.match(channelRegex)[1].toUpperCase()
      : () => false;
    const rawContentFormat =
      (args.extensionAPI.settings.get("content-format") as string) || "{block}";
    const contentFormat =
      getTextByBlockUid(extractRef(rawContentFormat)) || rawContentFormat;
    Promise.all([getUsers(token), getChannels(token)])
      .then(([members, channels]) => {
        const memberId = members.find(
          (m) => toName(m).toUpperCase() === aliasedName || findFunction(m)
        )?.id;
        const channelId = channels.find(
          (c) => c.name.toUpperCase() === aliasedName || channelFindFunction(c)
        )?.id;
        const channel = memberId || channelId;
        if (channel) {
          return apiGet({
            domain: "https://slack.com/api",
            path: "chat.postMessage",
            anonymous: true,
            data: {
              channel,
              text: contentFormat
                .replace(/{block}/gi, resolveRefs(message))
                .replace(/{last edited by}/gi, () => {
                  const email = getEditedUserEmailByBlockUid(blockUid);
                  const displayName = getDisplayNameByEmail(email);
                  const memberByEmail = members.find(
                    (m) => m.profile.email === email
                  );
                  return memberByEmail
                    ? `<@${memberByEmail.id}>`
                    : displayName || email;
                })
                .replace(/{page}/gi, () => getPageTitleByBlockUid(blockUid))
                .replace(
                  /{parent(?::\s*((?:#?\[\[[^\]]*\]\]\s*)+))?}/gi,
                  (_, t: string) =>
                    resolveRefs(
                      t
                        ? t
                            .trim()
                            .substring(2, t.trim().length - 2)
                            .split(/\]\]\s*\[\[/)
                            .map((tag) =>
                              getParentTextByBlockUidAndTag({ blockUid, tag })
                            )
                            .find((s) => !!s) ||
                            getParentTextByBlockUid(blockUid)
                        : getParentTextByBlockUid(blockUid)
                    )
                )
                .replace(
                  /{link}/gi,
                  `${window.location.href.replace(
                    /\/page\/.*$/,
                    ""
                  )}/page/${blockUid}`
                )
                .replace(aliasRegex, (_, alias, url) => `<${url}|${alias}>`),
              ...(asUser
                ? {
                    username: members.find(
                      (m) => m.profile.email === getCurrentUserEmail()
                    )?.name,
                    token: user_token,
                  }
                : { token }),
            },
          }).then(close);
        } else {
          setLoading(false);
          setError(
            `Couldn't find Slack user for tag: ${tag}.${
              aliasedName ? `\nTried to use alias: ${aliases[tag]}` : ""
            }`
          );
        }
      })
      .catch(({ error, message }) => {
        if (message?.endsWith?.("not_authed")) {
          setError("Not logged in. Head to the Roam Depot Settings to log in!");
        } else {
          setError(error || message);
        }
        setLoading(false);
      });
  }, [setLoading, close, tag, setError, asUser]);
  return (
    <div style={{ padding: 16 }}>
      <Button
        text={`Send to ${tag}`}
        onClick={onClick}
        style={{ marginBottom: 16 }}
      />
      <Checkbox label={"As User"} checked={asUser} onChange={onAsUserChanged} />
      {accountDropdown}
      {loading && <Spinner />}
      {error && (
        <div style={{ color: "red", whiteSpace: "pre-line" }}>
          <Text>{error}</Text>
        </div>
      )}
    </div>
  );
};

const SlackOverlay: React.FunctionComponent<ContentProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  return (
    <Popover
      target={
        <Icon
          icon={
            <Slack
              viewBox="70 70 130 130"
              style={{ width: 15, marginLeft: 4 }}
            />
          }
          onClick={open}
        />
      }
      content={<SlackContent {...props} close={close} />}
      isOpen={isOpen}
      onInteraction={setIsOpen}
    />
  );
};

export const render = ({
  parent,
  ...contentProps
}: {
  parent: HTMLSpanElement;
} & ContentProps): void =>
  ReactDOM.render(<SlackOverlay {...contentProps} />, parent);

export default SlackOverlay;
