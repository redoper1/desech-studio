import fs from 'fs'
import AdobexdCommon from './AdobexdCommon.js'
import ParseCommon from '../ParseCommon.js'
import File from '../../file/File.js'
import ImportSvg from '../ImportSvg.js'

export default {
  async getSvgContent (element, extra) {
    if (extra.data.type !== 'icon') return
    const content = `<svg viewBox="${this.getSvgNodeViewBox(element, extra)}" ` +
      'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
      await this.getSvgNodes(element, extra) +
    '</svg>'
    return { content }
  },

  getSvgNodeViewBox (element, extra) {
    if (element.shape?.type === 'polygon') {
      return `0 0 ${extra.data.width} ${extra.data.height}`
    } else { // path, compound, group
      // val.box has the x/y/width/height values in order, so we presume it's safe to just merge
      return Object.values(extra.svgData[element.id].box).join(' ')
    }
  },

  async getSvgNodes (element, extra) {
    const nodes = []
    if (element.group?.children?.length) {
      for (const child of element.group.children) {
        // only allow certain svg element; @todo implement the other elements too
        if (!['path', 'compound'].includes(child.shape?.type)) continue
        nodes.push(await this.getSvgNode(child, extra, true))
      }
    } else {
      nodes.push(await this.getSvgNode(element, extra))
    }
    return nodes.join('\n')
  },

  async getSvgNode (element, extra, isChild = false) {
    const gr = this.prepareDataForGradient(element)
    const bg = await this.prepareDataForImage(element, extra)
    const tag = this.getSvgNodeTag(element)
    const transform = isChild ? this.getSvgNodeTransform(element) : ''
    return ImportSvg.getGradientNode(gr) + ImportSvg.getPatternNode(bg) +
      `<${tag}${transform}${ImportSvg.getFillUrl(gr || bg)}/>`
  },

  getSvgNodeTag (element) {
    if (element.shape?.type === 'polygon') {
      const points = this.getPolygonPoints(element.shape.points)
      return `polygon points="${points}"`
    } else { // path, compound
      return `path d="${element.shape.path}"`
    }
  },

  getSvgNodeTransform (element) {
    const t = element.transform
    return t ? ` transform="translate(${Math.round(t.tx)} ${Math.round(t.ty)})"` : ''
  },

  getPolygonPoints (points) {
    // shape['uxdesign#cornerRadius'] and shape ['uxdesign#starRatio'] are ignored
    const array = []
    for (const point of points) {
      array.push(Math.round(point.x) + ',' + Math.round(point.y))
    }
    return array.join(' ')
  },

  prepareDataForGradient (element) {
    const gr = element.style?.fill?.gradient
    if (!gr) return
    const type = (gr.meta.ux.gradientResources.type === 'linear') ? 'linear' : 'radial'
    return {
      type,
      id: ImportSvg.getGradientId(),
      stops: this.getGradientStops(gr.meta.ux.gradientResources.stops),
      coords: (type === 'linear') ? this.getCoordsLinear(gr) : this.getCoordsRadial(gr)
    }
  },

  getGradientStops (stops) {
    const data = []
    for (const stop of stops) {
      data.push({
        offset: stop.offset,
        color: AdobexdCommon.getColor(stop.color)
      })
    }
    return data
  },

  getCoordsLinear (gr) {
    return {
      x1: gr.x1,
      x2: gr.x2,
      y1: gr.y1,
      y2: gr.y2
    }
  },

  getCoordsRadial (gr) {
    // angular gradients have other coordinates
    return {
      cx: gr.cx || gr.meta.ux.x,
      cy: gr.cx || gr.meta.ux.y,
      r: gr.r || gr.meta.ux.rotation
    }
  },

  async prepareDataForImage (element, extra) {
    const p = element.style?.fill?.pattern
    if (!p) return
    return {
      id: ImportSvg.getGradientId(),
      width: p.width,
      height: p.height,
      image: await this.getImageBse64(element.style.fill, extra)
    }
  },

  async getImageBse64 (fill, extra) {
    const imagePath = 'resources/' + fill.pattern.meta.ux.uid
    const ext = File.extname(fill.pattern.href).substring(1)
    const data = await ParseCommon.processLocalImages(imagePath, ext, extra)
    return {
      ext,
      base64: fs.readFileSync(data.path).toString('base64')
    }
  },

  getCssFillStroke (type, element) {
    if (type !== 'icon' || !element.style) return
    const css = {}
    this.addCssStroke(element.style, css)
    this.addCssColor(element.style, css)
    return css
  },

  addCssStroke (style, css) {
    if (style.stroke?.width) css['stroke-width'] = style.stroke.width + 'px'
    if (style.stroke?.dash) css['stroke-dasharray'] = style.stroke.dash.join(' ')
  },

  addCssColor (style, css) {
    if (style.stroke?.type === 'solid') {
      css.stroke = AdobexdCommon.getColor(style.stroke.color)
    }
    if (style.fill?.type === 'solid') {
      css.fill = AdobexdCommon.getColor(style.fill.color)
    } else if (style.fill?.type === 'none') {
      css.fill = 'transparent'
    }
  }
}
