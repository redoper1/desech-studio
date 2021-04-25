import { ResourceLoader } from 'jsdom'
import File from '../File.js'

export default class CustomResourceLoader extends ResourceLoader {
  async fetch (url, options) {
    if (File.extname(url) === '.css') {
      return await this.formatCssFile(url, options)
    }
    return await super.fetch(url, options)
  }

  async formatCssFile (url, options) {
    const file = File.basename(url)
    if (file === 'reset.css') {
      // ignore this file
      return Promise.resolve(Buffer.from(''))
    }
    if (file === 'component-css.css') {
      return await this.formatComponentCss(url, options)
    }
    return await super.fetch(url, options)
  }

  async formatComponentCss (url, options) {
    const css = (await super.fetch(url, options)).toString()
    // add "_ss_" to selectors
    const formatted = css.replace(/\.(.*?) {/g, '._ss_$1 {')
    return Promise.resolve(Buffer.from(formatted))
  }
}
