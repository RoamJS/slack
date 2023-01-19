# Slack

The Slack extension helps connect Roam to a Slack organization!

## Setup 
Add the RoamJS Slack App to your workspace by navigating to your Roam Depot settings for Slack and clicking the `Login with Slack` button.

Anytime you tag a person in a Roam block, a slack icon will render next to the tag. Clicking the icon and then clicking Send will send the contents of the block to the user matching the full name of the tag.

For example, this block:

`Sent from Roam!#[[David Vargas]]`

Will send the following message to David Vargas in slack:

`Sent from Roam!`

## Configuration

The Slack extension supports the following configuration options, found in the Roam Depot settings:

- User Format - (Optional) The format that Roam tags must be in to render the slack icon. By default, it uses `@{username}`.
  - Use the placeholder `{username}` to match a user based on their slack username. For example, `@{username}` matches the `#[[@dvargas92495]]` tag.
  - Use the placeholder `{real name}` to match a user based on their slack full name. For example, `{real name} (Slack)` matches the `#[[David Vargas (Slack)]]` tag.
- Channel Format - (Optional) The format that Roam tags must be in to render the slack icon for channels. By default, it uses `#{channel}`.
  - Use the placeholder `{channel}` to match a channel based on its slack channel name. For example, `#{channel}` matches the `#[[#general]]` tag.
  - For RoamJS to be able to post in a channel, you will need to add the app to the channel: ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FM3D44WzZAA.png)
- Aliases - (Optional) A block reference pointing to a specific mapping of Roam tags to Slack usernames to detect for the slack icon. This block could be located wherever in your graph. If this is defined, User Format will be ignored. Each alias should be its own block, with the slack username it maps to as a child of that block. For example, the block reference for `aliases` maps the `#[[This is Vargas!]]` tag to the `dvargas92495` slack username:
  - aliases
    - This is Vargas!
      - dvargas92495
- Content Format - (Optional) The format that Roam will use to send the message to Slack. By default, it uses `{block}`. 
  - Use the placeholder `{block}` to replace with the actual text of the block.
  - Use the placeholder `{last edited by}` to replace with the username of the user who last edited the sending block. If the Roam email address is not in the slack workspace, the Roam email will be inserted instead.
  - Use the placeholder `{page}` to replace with the name of the page the block lives in.
  - Use the placeholder `{parent}` to replace with the text of the parent of the current block. If you add a colon and a tag, it will grab the first parent with the given tag. For example, `{parent: [[Task]]}` will be replaced with `Project [[Task]]` in the following example:
    - `Project [[Task]]`
      - `Ignore this block`
        - `Send to #[[@dvargas92495]]`
  - Use the placeholder `{link}` to replace with the link to the zoomed in block.
