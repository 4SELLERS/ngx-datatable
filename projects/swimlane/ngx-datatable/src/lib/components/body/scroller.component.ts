import {
  Component,
  Input,
  ElementRef,
  Output,
  EventEmitter,
  Renderer2,
  NgZone,
  OnInit,
  OnDestroy,
  HostBinding,
  ChangeDetectionStrategy
} from '@angular/core';

@Component({
    selector: 'datatable-scroller',
    template: ` <ng-content></ng-content> `,
    host: {
        class: 'datatable-scroll'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ScrollerComponent implements OnInit, OnDestroy {
  @Input() scrollbarV: boolean = false;
  @Input() scrollbarH: boolean = false;

  @HostBinding('style.height.px')
  @Input()
  scrollHeight: number;

  @HostBinding('style.width.px')
  @Input()
  scrollWidth: number;

  @Output() scroll: EventEmitter<any> = new EventEmitter();

  scrollYPos: number = 0;
  scrollXPos: number = 0;
  prevScrollYPos: number = 0;
  prevScrollXPos: number = 0;
  element: any;
  parentElement: any;
  onScrollListener: any;

  private _scrollEventListener: any = null;

  constructor(private ngZone: NgZone, element: ElementRef, private renderer: Renderer2) {
    this.element = element.nativeElement;
  }

  ngOnInit(): void {
    // manual bind so we don't always listen
    if (this.scrollbarV || this.scrollbarH) {
      const renderer = this.renderer;
      this.parentElement = renderer.parentNode(renderer.parentNode(this.element));
      this._scrollEventListener = this.onScrolled.bind(this);
      this.parentElement.addEventListener('scroll', this._scrollEventListener);
    }
  }

  ngOnDestroy(): void {
    if (this._scrollEventListener) {
      this.parentElement.removeEventListener('scroll', this._scrollEventListener);
      this._scrollEventListener = null;
    }
  }

  setOffset(offsetY: number): void {
    if (this.parentElement) {
      this.parentElement.scrollTop = offsetY;
    }
  }

  onScrolled(event: CustomEvent): void {
    const dom: Element = <Element>event.target;
    requestAnimationFrame(() => {
      this.scrollYPos = dom?.scrollTop || 0;
      this.scrollXPos = dom?.scrollLeft || 0;
      this.updateOffsetInternal();
    });
  }

  updateOffset(): void {
    let direction: string;
    if (this.scrollYPos < this.prevScrollYPos) {
      direction = 'down';
    } else if (this.scrollYPos > this.prevScrollYPos) {
      direction = 'up';
    }

    this.scroll.emit({
      direction,
      scrollYPos: this.scrollYPos
    });

    this.prevScrollYPos = this.scrollYPos;
    this.prevScrollXPos = this.scrollXPos;
  }

  private updateOffsetInternal(): void {
    let direction: string;
    if (this.scrollYPos < this.prevScrollYPos) {
      direction = 'down';
    } else if (this.scrollYPos > this.prevScrollYPos) {
      direction = 'up';
    }

    this.scroll.emit({
      direction,
      scrollYPos: this.scrollYPos,
      scrollXPos: this.scrollXPos
    });

    this.prevScrollYPos = this.scrollYPos;
    this.prevScrollXPos = this.scrollXPos;
  }
}
