import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { createElement, icons } from 'lucide';

@Directive({
  selector: '[appLucide]',
  standalone: true,
})
export class LucideIconDirective implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) appLucide = 'Circle';
  @Input() iconSize = 18;
  @Input() iconStroke = 2;

  ngOnChanges(): void {
    const icon = icons[this.appLucide as keyof typeof icons] ?? icons.Circle;
    const svg = createElement(icon);
    svg.setAttribute('width', String(this.iconSize));
    svg.setAttribute('height', String(this.iconSize));
    svg.setAttribute('stroke-width', String(this.iconStroke));
    svg.setAttribute('aria-hidden', 'true');
    this.host.nativeElement.replaceChildren(svg);
  }
}
