// Utility functions for working with file attributes.
// Currently implemented using Linux xattrs (extended attributes),
// but could be implemented using other methods (like a sidecar file) in the future.
//
// It would be nice to use https://www.npmjs.com/package/fs-xattr, but it seems suspiciously unmaintained.
// Instead, for the moment we just shell out to the `setfattr` and `getfattr` commands
// (provided by https://savannah.nongnu.org/projects/attr/; usually seen as a package named `attr` on most distros).

import {spawn} from 'node:child_process'

/**
 * Sets an extended attribute on a file.
 * 
 * @param {string} filename - The path to the file.
 * @param {string} name - The name of the attribute.
 * @param {string} value - The value to set for the attribute.
 * @returns {Promise<void>} - A promise that resolves when the attribute is set.
 */
export async function setAttribute(filename, name, value) {
    return new Promise((resolve, reject) => {
        const setfattr = spawn('setfattr', ['-n', name, '-v', value, filename], {stdio: ['ignore', 'pipe', 'inherit']})
        setfattr.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`setfattr exited with code ${code}`))
            }
        })
        setfattr.on('error', reject)
    })
}

/**
 * Asynchronously retrieves the value of an extended attribute for a given file.
 *
 * @param {string} filename - The path to the file.
 * @param {string} name - The name of the extended attribute to retrieve.
 * @returns {Promise<string>} A promise that resolves with the value of the extended attribute.
 */
export async function getAttribute(filename, name) {
    return new Promise((resolve, reject) => {
        const getfattr = spawn('getfattr', ['-n', name, '--only-values', '--absolute-names', '--', filename], {stdio: ['ignore', 'pipe', 'inherit']})
        let output = ''
        getfattr.stdout.on('data', data => {
            output += data.toString()
        })
        getfattr.on('close', code => {
            if (code === 0) {
                resolve(output)
            } else {
                reject(new Error(`getfattr exited with code ${code}`))
            }
        })
        getfattr.on('error', reject)
    })
}
