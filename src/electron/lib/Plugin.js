import { app, shell } from 'electron'
import fetch from 'node-fetch'
import fse from 'fs-extra'
import path from 'path'
import fs from 'fs'
import os from 'os'
import AdmZip from 'adm-zip'
import File from '../file/File.js'
import ProjectCommon from '../project/ProjectCommon.js'
import HelperPlugin from '../../js/helper/HelperPlugin.js'
import Zip from '../file/Zip.js'
import HelperFile from '../../js/helper/HelperFile.js'
import Config from './Config.js'
import Electron from './Electron.js'

export default {
  _DIR: null,

  async initPlugins () {
    this._DIR = path.resolve(app.getPath('userData'), 'plugin')
    File.createFolder(this._DIR)
    await this.updatePlugins()
  },

  async updatePlugins () {
    const plugins = this.getInstalledPlugins()
    for (const plugin of plugins) {
      await this.updatePlugin(plugin)
    }
  },

  async updatePlugin (plugin) {
    if (!plugin.autoupdate) return
    const data = await this.fetchPluginData(plugin.url)
    if (plugin.version === data.version) return
    await this.copyPlugin(plugin.url)
  },

  async fetchPluginData (repoUrl) {
    const url = repoUrl.replace('github.com', 'raw.githubusercontent.com') +
      '/master/package.json'
    const response = await fetch(url)
    return await response.json()
  },

  async installPlugin (url) {
    await this.copyPlugin(url)
    Electron.reload()
  },

  async copyPlugin (url) {
    const folder = await this.unzipTemp(url)
    const data = this.getFolderPluginData(folder)
    if (!data) throw new Error(`No package.json data found for ${url}`)
    this.moveTmpFolder(folder, url)
  },

  async unzipTemp (url) {
    const buffer = await this.getApiZip(url)
    const zip = new AdmZip(buffer)
    const folder = Zip.unzipInstanceTmp(zip)
    // we want the subfolder
    return path.resolve(folder, fs.readdirSync(folder)[0])
  },

  async getApiZip (url) {
    // const apiUrl = url.replace('github.com', 'api.github.com/repos') + '/zipball'
    const response = await fetch(url + '/archive/master.zip')
    return await response.buffer()
  },

  getFolderPluginData (folder) {
    for (const file of fs.readdirSync(folder)) {
      if (file !== 'package.json') continue
      const data = File.getFileData(file, folder)
      return data.desech
    }
  },

  moveTmpFolder (folder, url) {
    const pluginName = HelperPlugin.getPluginName(url)
    let dest = path.resolve(this._DIR, pluginName)
    if (fs.existsSync(dest)) {
      dest = HelperFile.convertPathForWin(dest, os.platform())
      // clean it up if it exists (when upgrading)
      shell.moveItemToTrash(dest)
    }
    fse.copySync(folder, dest)
  },

  getInstalledPlugins () {
    const list = []
    const files = fs.readdirSync(this._DIR, { withFileTypes: true })
    for (const entry of files) {
      const data = this.getInstalledPluginData(entry)
      if (data) list.push(data)
    }
    return list
  },

  getInstalledPluginData (entry) {
    if (!entry.isDirectory()) return
    const folder = path.resolve(this._DIR, entry.name)
    if (!fs.existsSync(path.resolve(folder, 'package.json'))) return
    const data = File.getFileData('package.json', folder)
    if (!data.desech) return
    return {
      ...data.desech,
      version: data.version,
      installed: true,
      folder
    }
  },

  async getAllPlugins () {
    const list = await this.getPluginsList()
    const installed = this.getInstalledPlugins()
    for (const plugin of list) {
      for (let i = 0; i < installed.length; i++) {
        if (plugin.url === installed[i].url) {
          plugin.installed = true
          installed.splice(i, 1)
          break
        }
      }
    }
    return [...list, ...installed]
  },

  async getPluginsList () {
    const response = await fetch(Config.getConfig('api') + '/plugins')
    const json = await response.json()
    return json.plugins
  },

  removePlugin (url) {
    const pluginName = HelperPlugin.getPluginName(url)
    let pluginPath = path.resolve(this._DIR, pluginName)
    if (fs.existsSync(pluginPath)) {
      pluginPath = HelperFile.convertPathForWin(pluginPath, os.platform())
      shell.moveItemToTrash(pluginPath)
    }
    Electron.reload()
  },

  async triggerPlugin (category, method, data = null) {
    const project = await ProjectCommon.getProjectSettings()
    if (!project[category]) return
    const file = path.resolve(this._DIR, project[category], 'index.js')
    const module = require(file)
    if (!(method in module)) {
      throw new Error(`Unknown "${method}" method for active plugin category "${category}"`)
    }
    return await module[method](data)
  }
}
