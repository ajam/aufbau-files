Aufbau files
============

> A simple [Aufbau](http://github.com/ajam/aufbau) app for downloading files.

## Setup

Fork this repository and add your own files to the `files/` folder. 

## Including in your Aufbau app

Generally, you wouldn't publish this repository to npm so you include it your Aufbau `package.json` with `<github-username>/<repo-name>`. You can also add a commit sha preceeded by a `#` if you want to keep it versioned.

Then the following to your `apps.json`. If you've changed the name of the repo, make sure `packageName` corresponds to the new name

````json
{
	"displayName": "Files",
	"package": {
      "aufbau-files": "ajam/aufbau-files"
    },
	"indexPath": "src/index.html",
	"buildCmd": "npm run build"
}
````

