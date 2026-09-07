/** Stand-in for `three-spritetext`: a `Sprite` carrying text/height/color. */

import { Sprite } from './three-fake';

export default class SpriteText extends Sprite {
  text: string;
  textHeight: number;
  color: string;
  constructor(text = '', textHeight = 10, color = 'white') {
    super();
    this.text = text;
    this.textHeight = textHeight;
    this.color = color;
  }
}
