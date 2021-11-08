import HelperComponent from './HelperComponent.js'
import HelperElement from './HelperElement.js'
import HelperDOM from './HelperDOM.js'
import ExtendJS from './ExtendJS.js'
import HelperStyle from './HelperStyle.js'

export default {
  getParents (element, type) {
    if (type === 'element' && HelperComponent.belongsToAComponent(element)) {
      return this.getElementParents(element)
    } else if (type === 'component' && HelperComponent.isComponentElement(element)) {
      return this.getComponentParents(element.parentNode)
    } else if (type === 'component') {
      // top level components, don't have any parents, but we should be able to reset them
      const data = HelperComponent.getComponentData(element)
      return [{ element, data, topLevel: true }]
    }
  },

  getElementParents (element, structure = []) {
    if (HelperComponent.isComponent(element)) {
      // the component root element
      this.addElementToStructure(element, structure)
      return this.getComponentParents(element.parentNode, structure)
    } else if (HelperComponent.isComponentHole(element)) {
      // the component hole element
      const component = element.closest('[data-ss-component]')
      if (!component) return structure
      this.addElementToStructure(component, structure)
      return this.getComponentParents(component.parentNode, structure)
    } else if (HelperComponent.isComponentElement(element)) {
      // a regular component element
      return this.getComponentParents(element, structure)
    }
  },

  addElementToStructure (element, structure) {
    const data = HelperComponent.getComponentData(element)
    structure.unshift({ element, data })
  },

  getComponentParents (element, structure = []) {
    if (!element) return structure
    const node = element.closest('[data-ss-component], [data-ss-component-hole]')
    if (!node) return structure
    if (HelperComponent.isComponentHole(node)) {
      // when we find a hole, we need to skip its component
      const parent = node.closest('[data-ss-component]')?.parentNode
      this.getComponentParents(parent, structure)
    } else { // component
      this.addElementToStructure(node, structure)
      if (HelperComponent.isComponentElement(node)) {
        this.getComponentParents(node.parentNode, structure)
      }
    }
    return structure
  },

  getOverrides (element, type) {
    const parents = this.getParents(element, type)
    if (!parents?.length) return
    const ref = this.getOverrideRef(element, type)
    return this.getOverrideData(parents, ref, 'full')
  },

  getOverrideRef (element, type) {
    return (type === 'element')
      ? HelperElement.getStyleRef(element)
      : HelperComponent.getInstanceRef(element)
  },

  // type: original, full
  getOverrideData (parents, ref, type) {
    let data = this.getInitialData(parents[0].data, type)
    for (let i = 1; i < parents.length; i++) {
      data = this.getOverrideDataParent(data, parents[i].data.ref)
    }
    return this.returnOverrideData(parents, data, ref)
  },

  getInitialData (data, type) {
    if (type === 'original') {
      // this mutates data and is needed when setting values directly
      if (!data.overrides) data.overrides = {}
      return data.overrides
    } else if (type === 'full') {
      // this doesn't mutate and is needed for checking against overwritten values
      return this.getFullOverrides(data)
    }
  },

  getOverrideDataParent (data, ref) {
    if (!data[ref]) data[ref] = {}
    if (!data[ref].children) data[ref].children = {}
    return data[ref].children
  },

  returnOverrideData (parents, data, ref) {
    // usually we get data from our ref index, but when we are at the top, we check for any data
    if (parents[0].topLevel) {
      return !ExtendJS.isEmpty(data) ? { children: data } : {}
    } else {
      if (!data[ref]) data[ref] = {}
      return data[ref]
    }
  },

  getFullOverrides (data) {
    const overrides = {}
    this.mergeVariants(data, overrides)
    if (data?.fullOverrides) {
      this.mergeObjects(overrides, data.fullOverrides)
    } else if (data?.overrides) {
      this.mergeObjects(overrides, data.overrides)
    }
    return overrides
  },

  mergeVariants (data, overrides) {
    if (!data?.variants) return
    for (const [name, value] of Object.entries(data.variants)) {
      // when we delete variants, we don't cleanup because of undo
      // this means we can have missing variants
      if (data?.main?.variants[name] && data.main.variants[name][value]) {
        this.mergeObjects(overrides, data.main.variants[name][value])
      }
    }
  },

  // obj1 is mutated
  mergeObjects (obj1, obj2) {
    ExtendJS.mergeDeep(obj1, obj2)
    this.mergeObjectsFix(obj1)
  },

  mergeObjectsFix (obj) {
    // mergeDeep will merge everything including the attribute/property/class values
    // if we have these pairs value/delete or add/delete, remove the first value
    if (Object.keys(obj).length === 2 && (('value' in obj && 'delete' in obj) ||
      ('add' in obj && 'delete' in obj))) {
      delete obj[Object.keys(obj)[0]]
    }
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        this.mergeObjectsFix(obj[key])
      }
    }
  },

  highlightOveride (template, check, cls) {
    if (!check) return
    for (const node of template.getElementsByClassName(cls)) {
      node.classList.add('override')
    }
  },

  highlightOverideAttributes (template, attributes) {
    if (!attributes) return
    const fields = this.getAttributeFields(template)
    for (const field of fields) {
      if (field.name in attributes) {
        field.classList.add('override')
      }
    }
  },

  getAttributeFields (template) {
    const detailsForm = template.getElementsByClassName('style-html-details')[0]
    const detailFields = detailsForm?.elements || []
    return [...template.elements, ...detailFields]
  },

  highlightOverideCustomAttributes (template, attributes) {
    if (!attributes) return
    const forms = template.getElementsByClassName('style-html-element-form')
    for (const form of forms) {
      if (form.elements.name.value in attributes) {
        form.elements.name.classList.add('override')
        form.elements.value.classList.add('override')
      }
    }
  },

  highlightOverideProperties (template, properties) {
    if (!properties) return
    const blocks = template.getElementsByClassName('style-component-property')
    for (const block of blocks) {
      const fields = block.getElementsByClassName('style-component-property-field')
      if (fields[0].value in properties) {
        fields[0].classList.add('override')
        fields[1].classList.add('override')
      }
    }
  },

  highlightOverideClasses (template, classes) {
    if (!classes) return
    const selectors = template.getElementsByClassName('selector-element')
    for (const li of selectors) {
      this.highlightOverideClass(li, classes)
    }
  },

  highlightOverideClass (li, classes) {
    const selectorClass = HelperStyle.getClassFromSelector(li.dataset.selector)
    const cls = HelperStyle.getViewableClass(selectorClass)
    if (classes[cls]) {
      li.classList.add('override')
    }
  },

  highlightOverideClassesWarning (template, classes) {
    const warning = template.getElementsByClassName('style-override-warning')[0]
    const deletedClasses = this.getDeletedRecords(classes)
    if (deletedClasses) {
      HelperDOM.show(warning)
      this.injectTooltipRecords(warning, 'classes', deletedClasses)
    }
  },

  highlightOverideWarning (template, overrides, elementType = null) {
    const nodes = template.getElementsByClassName('style-override-warning')
    const deletedAttrs = this.getDeletedAttributes(template, overrides?.attributes)
    const deletedProps = this.getDeletedRecords(overrides?.properties)
    for (const node of nodes) {
      if ((node.dataset.type === 'text' && elementType === 'text' && overrides?.inner) ||
        (node.dataset.type === 'attributes' && deletedAttrs) ||
        (node.dataset.type === 'properties' && deletedProps)) {
        this.highlightOverideWarningNode(node, deletedAttrs, deletedProps)
      }
    }
  },

  highlightOverideWarningNode (node, deletedAttrs, deletedProps) {
    HelperDOM.show(node)
    if (node.dataset.type === 'attributes') {
      this.injectTooltipRecords(node, 'attributes', deletedAttrs)
    } else if (node.dataset.type === 'properties') {
      this.injectTooltipRecords(node, 'properties', deletedProps)
    }
  },

  getDeletedAttributes (template, attributes) {
    const deleted = this.getDeletedRecords(attributes)
    if (!deleted) return
    const regular = this.getRegularAttributes(template)
    // remove the detail fields; we only care about the custom attributes
    for (let i = deleted.length - 1; i >= 0; i--) {
      if (regular.includes(deleted[i])) {
        deleted.splice(i, 1)
      }
    }
    return deleted.length ? deleted : null
  },

  getRegularAttributes (template) {
    const fields = this.getAttributeFields(template)
    const names = fields.map(field => field.name)
    return ExtendJS.unique(names)
  },

  getDeletedRecords (obj) {
    if (!obj) return null
    const records = []
    for (const [name, val] of Object.entries(obj)) {
      if (val.delete) records.push(name)
    }
    return (records.length) ? records : null
  },

  injectTooltipRecords (node, type, records) {
    if (node.dataset.type === type) {
      if (records) {
        node.dataset.tooltip += ' ' + records.join(', ')
      } else {
        delete node.dataset.tooltip
      }
    }
  }
}
