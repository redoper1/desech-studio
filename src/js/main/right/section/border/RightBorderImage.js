import HelperStyle from '../../../../helper/HelperStyle.js'
import InputUnitField from '../../../../component/InputUnitField.js'
import StateStyleSheet from '../../../../state/StateStyleSheet.js'
import HelperEvent from '../../../../helper/HelperEvent.js'
import RightCommon from '../../RightCommon.js'
import StyleSheetSelector from '../../../../state/stylesheet/StyleSheetSelector.js'
import ColorPickerGradient from '../../../../component/color-picker/ColorPickerGradient.js'
import RightBorderFillProperty from './RightBorderFillProperty.js'

export default {
  getEvents () {
    return {
      click: ['clickSliceFillEvent'],
      change: ['changeOutsetEvent', 'changeSliceEvent', 'changeRepeatEvent'],
      setsource: ['setsourceImageEvent']
    }
  },

  handleEvent (event) {
    HelperEvent.handleEvents(this, event)
  },

  changeOutsetEvent (event) {
    if (event.target.classList.contains('border-image-outset')) {
      this.inputOutset(event.target)
    }
  },

  changeSliceEvent (event) {
    if (event.target.classList.contains('border-image-slice')) {
      this.inputSlice(event.target)
    }
  },

  clickSliceFillEvent (event) {
    if (event.target.closest('.border-slice-fill-button')) {
      this.clickSliceFill(event.target.closest('.border-slice-fill-button'))
    }
  },

  changeRepeatEvent (event) {
    if (event.target.classList.contains('border-image-repeat')) {
      this.changeRepeat(event.target.closest('form').elements)
    }
  },

  setsourceImageEvent (event) {
    if (event.target.closest('.border-fill-container #picker-source-image')) {
      this.setImageSource(event.target, event.detail)
    }
  },

  inputOutset (input) {
    const fullValue = StateStyleSheet.getPropertyValue('border-image-outset')
    RightCommon.changeStyle({
      'border-image-outset': this.getInput4SidesValue(input, fullValue)
    })
  },

  getInput4SidesValue (input, fullValue) {
    const type = input.closest('.border-fill-container').dataset.type
    const value = InputUnitField.getValue(input)
    return HelperStyle.set4SidesValue(type, value, fullValue)
  },

  inputSlice (input) {
    const fullValue = StateStyleSheet.getPropertyValue('border-image-slice')
    const allSides = this.getInput4SidesValue(input, this.removeFill(fullValue))
    const value = allSides + (this.hasFill(fullValue) ? ' fill' : '')
    RightCommon.changeStyle({ 'border-image-slice': value })
  },

  removeFill (value) {
    return value.replace('fill', '').trim()
  },

  hasFill (value) {
    return value.includes('fill')
  },

  clickSliceFill (button) {
    const value = this.removeFill(StateStyleSheet.getPropertyValue('border-image-slice'))
    const finalValue = button.classList.contains('selected') ? value + ' fill' : value
    RightCommon.changeStyle({ 'border-image-slice': finalValue })
  },

  changeRepeat (fields) {
    let value = (fields.repeat1.value || 'stretch') + ' ' +
      (fields.repeat2.value || 'stretch')
    for (const check of ['inherit', 'initial', 'unset']) {
      if (value.includes(check)) value = check
    }
    RightCommon.changeStyle({ 'border-image-repeat': value })
  },

  setImageSource (button, file) {
    file = encodeURI(file)
    ColorPickerGradient.setBackgroundImageSource(button.closest('.fill-image'), file)
    const background = `url("${file}")`
    RightBorderFillProperty.updatePreviewSwatch(button.closest('#border-section'), background)
    RightCommon.changeStyle({ 'border-image-source': background })
  },

  injectBorderImage (container) {
    const fields = container.getElementsByClassName('fill-border-image')[0].elements
    const type = container.closest('.border-fill-container').dataset.type
    const selector = StyleSheetSelector.getCurrentSelector()
    this.injectOutset(fields.outset, type, selector)
    this.injectSlice(fields.slice, type, selector)
    this.injectFill(fields.fill, selector)
    this.injectRepeat(fields, selector)
  },

  injectOutset (field, type, selector) {
    const fullValue = StateStyleSheet.getPropertyValue('border-image-outset', selector)
    const value = HelperStyle.get4SidesValue(type, fullValue)
    InputUnitField.setValue(field, value)
  },

  injectSlice (field, type, selector) {
    const slice = StateStyleSheet.getPropertyValue('border-image-slice', selector)
    const fullValue = this.removeFill(slice)
    const value = HelperStyle.get4SidesValue(type, fullValue)
    InputUnitField.setValue(field, value)
  },

  injectFill (field, selector) {
    const fullValue = StateStyleSheet.getPropertyValue('border-image-slice', selector)
    if (this.hasFill(fullValue)) field.classList.add('selected')
  },

  injectRepeat (fields, selector) {
    const repeat = StateStyleSheet.getPropertyValue('border-image-repeat', selector)
    const parts = repeat.split(' ')
    fields.repeat1.value = parts[0] || ''
    fields.repeat2.value = parts[1] || ''
  }
}
