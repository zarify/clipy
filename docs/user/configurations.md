# Loading configurations

There is a sample configuration built into this repo with feedback, tests, starter code etc.
However, it isn't much good just being able to solve one problem, so we need to be able to load
*different* problems into the app.

For the user, there are currently three methods (for authoring and testing this looks slightly
different):
- Loading a config file from a web site
- Loading a config that has been added to the same server the app is hosted on
- Loading a *list* of configs using the same method as the above two options

> [!NOTE]
> If you are loading a config file from another web site, the site must allow cross-origin
> requests, otherwise the load will fail. You can store these files in a Github repo and
> use the `raw` URL which looks like this: `https://raw.githubusercontent.com/.../config_name.json`

## Load from URL

To load a config from a website, use the `?config=` URL parameter like this:

`https://URL-for-app-host/app-path/?config=https://full-URL-to-config-file.json`

So for example to load one of my testing files into the version of the app hosted on my site
I would use:

`https://headtilt.me/clipy/?config=https://raw.githubusercontent.com/zarify/clipy-configs/refs/heads/main/testing-while-break%401.0.json`

Here is another example that loads a list using the same URL parameter:

`https://headtilt.me/clipy/?config=https://raw.githubusercontent.com/zarify/clipy-configs/refs/heads/main/index.json`

## Load from server

The other method for loading configurations is to store them in the `/config` folder of the app.

This allows you to use the same `?config=` URL parameter but just pass the config file name instead of an entire URL:

`https://URL-for-app-host/app-path/?config=config-file-name.json`

For example to load the default config I provide in the app you use something like this:

`https://headtilt.me/clipy/?config=sample.json`

This method works for config lists that are stored in the `/config` folder of the app as well.