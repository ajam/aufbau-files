Aufbau files
============

> A simple [Aufbau](http://github.com/ajam/aufbau) app for downloading files.

## Setup

Fork this repository and add your own files to the `files/` folder. 

## Including in your Aufbau app

Add the following to your `apps.json`. You can also add a commit sha preceeded by a `#` if you want to keep it versioned. See the [npm documentation](https://docs.npmjs.com/files/package.json#git-urls-as-dependencies) for more about that.

````json
{
	"package": {
      "aufbau-files": "ajam/aufbau-files"
    },
	"displayName": "Files",
	"indexPath": "src/index.html",
	"buildCmd": "npm run build"
}
````

