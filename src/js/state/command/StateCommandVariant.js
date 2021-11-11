import HelperComponent from '../../helper/HelperComponent.js'
import HelperTrigger from '../../helper/HelperTrigger.js'
import LeftFileLoad from '../../main/left/file/LeftFileLoad.js'
import CanvasElementSelect from '../../main/canvas/element/CanvasElementSelect.js'
import ExtendJS from '../../helper/ExtendJS.js'
import HelperCanvas from '../../helper/HelperCanvas.js'
import HelperFile from '../../helper/HelperFile.js'
import StateCommandOverride from './StateCommandOverride.js'
import HelperElement from '../../helper/HelperElement.js'

export default {
  async saveVariant (component, name, value, overrides, undo) {
    const data = HelperComponent.getComponentData(component)
    this.addVariantToMain(data, name, value, overrides)
    await window.electron.invoke('rendererSaveComponentData', data.file, data.main)
    if (!undo) {
      // this happens when we create a new variant from overrides
      this.addVariantToInstances(data, name, value, component)
    } else {
      // this happens when we undo a variant delete
      await this.reloadPageAndSelectRef(data.ref)
    }
  },

  addVariantToMain (data, name, value, overrides) {
    if (!data.main) data.main = {}
    if (!data.main.variants) data.main.variants = {}
    if (!data.main.variants[name]) data.main.variants[name] = {}
    data.main.variants[name][value] = overrides
  },

  addVariantToInstances (data, name, value, component) {
    delete data.overrides
    this.updateVariantInstance(data, name, value, component)
    this.saveMainDataAllComponents(data.file, data.main)
    HelperTrigger.triggerReload('component-section')
  },

  updateVariantInstance (data, name, value, component) {
    if (!data.variants) data.variants = {}
    if (value) {
      data.variants[name] = value
    } else {
      delete data.variants[name]
    }
    HelperComponent.setComponentData(component, data)
  },

  saveMainDataAllComponents (file, mainData) {
    const components = HelperCanvas.getCanvas().querySelectorAll('[data-ss-component]')
    for (const component of components) {
      const data = HelperComponent.getComponentData(component)
      if (data.file !== file) continue
      data.main = mainData
      HelperComponent.setComponentData(component, data)
    }
  },

  async deleteVariant (component, name, value, undo) {
    const data = HelperComponent.getComponentData(component)
    const overrides = this.deleteVariantFromMain(data, name, value)
    await window.electron.invoke('rendererSaveComponentData', data.file, data.main)
    if (undo) {
      // this happens when we undo a variant create
      this.deleteVariantFromInstances(component, data, name, overrides)
    } else {
      // this happens when we delete an existing variant which can be used by other instances
      await this.reloadPageAndSelectRef(data.ref)
    }
  },

  deleteVariantFromMain (data, name, value) {
    const overrides = ExtendJS.cloneData(data.main.variants[name][value])
    delete data.main.variants[name][value]
    ExtendJS.clearEmptyObjects(data)
    return overrides
  },

  deleteVariantFromInstances (component, data, name, overrides) {
    data.overrides = overrides
    delete data.variants[name]
    HelperComponent.setComponentData(component, data)
    this.saveMainDataAllComponents(data.file, data.main)
  },

  async reloadPageAndSelectRef (ref) {
    await LeftFileLoad.reloadCurrentFile()
    const component = HelperElement.getElement(ref)
    CanvasElementSelect.selectElementNode(component)
  },

  async switchVariant (component, name, value) {
    const data = HelperComponent.getComponentData(component)
    if (HelperComponent.isComponentElement(component)) {
      await this.switchOverrideVariant(data, name, value, component)
    } else {
      this.updateVariantInstance(data, name, value, component)
      await HelperComponent.replaceComponent(component, data)
    }
  },

  async switchOverrideVariant (data, name, value, component) {
    if (!data.variants) data.variants = {}
    data.variants[name] = value
    const parents = await StateCommandOverride.overrideComponent(component, 'variants',
      data.variants)
    await HelperComponent.replaceComponent(parents[0].element, parents[0].data, data.ref)
  },

  async renameVariant (component, ref, values) {
    const data = HelperComponent.getComponentData(component)
    this.renameVariantInMain(data.main.variants, values)
    await window.electron.invoke('rendererSaveComponentData', data.file, data.main)
    const file = HelperFile.getRelPath(data.file)
    await window.electron.invoke('rendererRenameVariant', file, values)
    await this.reloadPageAndSelectRef(ref)
  },

  renameVariantInMain (variants, data) {
    if (data.name !== data.oldName) {
      variants[data.name] = ExtendJS.cloneData(variants[data.oldName])
      delete variants[data.oldName]
    }
    if (data.value !== data.oldValue) {
      variants[data.name][data.value] = ExtendJS.cloneData(variants[data.name][data.oldValue])
      delete variants[data.name][data.oldValue]
    }
  }
}
