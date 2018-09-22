# Fluentd log inspector
This is a simple script to inspect [fluentd](https://www.fluentd.org/) logs.

## Prerequisites
Node.js >= 10 is required

## How to
1. Clone the repository  
   `git clone https://github.com/gihan9a/fluentd-log-inspector.git`
2. Install dependencies  
   `npm ci`
3. Run  
   `npm run inspect -- --dir=<log directory>`

## CLI options
### `--dir`
Location of the `.log` files directory. Should be absolute path.

### `[--duplicate [=first]]`
Duplicate check mode. Default to `first`.  
Acceptable arguments,  
- `first`  
        Checks only the first line of log entry. Using this option reduces the final output. So it's easy to the go through the final inspection.
        **Important** If it's a stack trace, there can be other instances where this entry has occured. So it's recommendad to check with `all` option.
- `all`  
        Checks whole log message to check duplicates. This gives more verbose output in final inspection.

## Important
`/runtime` directory should be writable by node

After the inspection of log files a node server will be started at http://localhost:9999 OR the given port


## What inspection are performed?
- inspectr scans `.log` files in the directory.
- It checks how many times an entry has repeated in given logs.
- It ignores following entries in log.
    - If the entry is not in `yii.error` category.
    - 404 errors that have repeated only one time.
    - Messages defined in the `/exclude.js` file.

