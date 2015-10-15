Aufbau files
============

> An [Aufbau](http://github.com/ajam/aufbau) app for downloading files and accessing them via a network share, if so desired.

## Setup

Fork this repository and add your own files to the `files/` folder. Copy `aufbau-files-secrets.sample.json` to your root aufbau app and rename to `aufbau-files-secrets.json`.

Define your file locations in the `default-buckets.json` file. It can be a local folder in this repo or if you define `type` to `'local'` or on an smb network share like below. Setting `permanent` to `true` will mean users can't delete that bucket. Users can add and remove all other buckets from within the interface and their changes will be saved to their user directory, usually under `Application Support` if they're on OS X.

```json
[
  {
    "name": "Admin files",
    "type": "local",
    "dir": "files",
    "permanent": true
  },
  {
    "name": "Interactive team",
    "type": "smb",
    "dir": "path\\to\\folder"
  }
]
```

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

