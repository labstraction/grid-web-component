class AntroGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
  }

  getColumnWidth(withGap = true) { 
    if (!this.grid) return 0;
    const gap = withGap ? this._gap : 0;
    return (this.grid.clientWidth - gap * (this._cols - 1)) / this._cols;
  }

  getColumnsNumber() {
    const width = this.grid.clientWidth;
    const breakpoints = tryParseJson(this.dataset.breakpoints, [[1, 600], [2, 900], [4, 1200]]);
    const maxCols = parseInt(this.dataset.maxColumns || 6);
    let selectedBreakpoint = null;
    let minDiff = Infinity;
    for (let i = 0; i < breakpoints.length; i++) {
      if (width < breakpoints[i][1] && (breakpoints[i][1] - width) < minDiff) {
        selectedBreakpoint = breakpoints[i];
        minDiff = breakpoints[i][1] - width;
      }
    }
    return selectedBreakpoint ? selectedBreakpoint[0] : maxCols;
  }

  setStyle(cols, colWidth, gap) {
    let styleTag = this.shadowRoot.querySelector('style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      this.shadowRoot.appendChild(styleTag);
    }
    styleTag.textContent = `
      * {
        box-sizing: border-box;
      }
      #grid {
        display: grid;
        grid-template-columns: repeat(${cols}, ${colWidth}px);
        grid-auto-rows: ${colWidth}px;
        grid-auto-flow: row;
        gap: ${gap}px;
      }
      .item-wrapper {
          background: #ffdddd;
      }
      .item-wrapper[resizing] {
          position: relative;
      }
      .item-inner {
          width: 100%;
          height: 100%;
          padding: 12px;
          background: white;
          position: relative;
          border: 1px solid limegreen;
      }
      .item-inner[resizing] {
          position: absolute !important;
          top: 0;
          left: 0;
          z-index: 1000;
      }
      .handle {
          position: absolute;
          width: 10px;
          height: 10px;
          background: transparent;
          padding: 0;
          border: none;
          margin: 1px;
      }
      .move {
          top: 1px;
          left: 1px;
          cursor: move;
      }
      .resize {
          bottom: 1px;
          right: 1px;
          cursor: se-resize;
      }
      .delete {
          top: 1px;
          right: 1px;
          cursor: pointer;
      }
      .none {
          display: none;
      }
    `;
  }

  get grid() {
    if (this._gridEl) return this._gridEl;
    this._gridEl = document.createElement('div');
    this._gridEl.id = 'grid';
    this.shadowRoot.appendChild(this._gridEl);
    return this._gridEl;
  }

  connectedCallback() {
    this._cols = parseInt(this.dataset.maxColumns || 6);
    this._gap = parseInt(this.dataset.gap || 8);
    this._maxW = parseInt(this.dataset.maxItemWidth || this._cols);
    this._maxH = parseInt(this.dataset.maxItemHeight || this._cols);
    this._minW = parseInt(this.dataset.minItemWidth || 1);
    this._minH = parseInt(this.dataset.minItemHeight || 1);
    this._items = [];
    const observer = new ResizeObserver((el) => {
      const newWidth = el[0].contentRect.width;
      if (newWidth !== this._gridElWidth) {
        this._cols = this.getColumnsNumber();
        console.log('Grid resized, new columns:', this._cols);
        this._gridElWidth = newWidth;
        this.setStyle(this.getColumnsNumber(), this.getColumnWidth(), this._gap);
        this._setupGrid();
      }

    });
    observer.observe(this.grid);
  }

  _setupGrid() {
    this._slot = this.shadowRoot.querySelector('slot');
    const slotTimeout = setTimeout(() => {
      this._initItems();
    }, 50);
    this._slot.addEventListener('slotchange', () => {
      console.log('Slot changed, re-initializing items');
      clearTimeout(slotTimeout);
      this._initItems()
    });
  }

  _initItems() {
    const assigned = this._slot.assignedElements();
    assigned.forEach(el => {
      const wrap = this._wrapElement(el);
      this._applyPosition(wrap, el);
    });
  }

  _wrapElement(el) {
    const existingWrap = el.parentElement ? el.parentElement.parentElement : null;
    if (existingWrap && existingWrap.classList.contains('item-wrapper')) {
      return existingWrap;
    }

    const wrap = document.createElement('div');
    wrap.className = 'item-wrapper';
    const inner = document.createElement('div');
    inner.className = 'item-inner';
    inner.setAttribute('draggable', 'true');

    const resizeHandle = document.createElement('button');
    resizeHandle.classList.add('handle', 'resize', 'none');
    resizeHandle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3 9H9V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 9V6H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

    const moveHandle = document.createElement('button');
    moveHandle.classList.add('handle', 'move', 'none');
    moveHandle.id = 'move-handle';
    moveHandle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M4 2L5 1L6 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M4 8L5 9L6 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M2 4L1 5L2 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 4L9 5L8 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

    const deleteHandle = document.createElement('button');
    deleteHandle.classList.add('handle', 'delete', 'none');
    deleteHandle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1L9 9M1 9L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

    deleteHandle.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.remove();
      this._items = this._items.filter(i => i.wrap !== wrap);
    });

    inner.appendChild(el);
    inner.appendChild(resizeHandle);
    inner.appendChild(moveHandle);
    inner.appendChild(deleteHandle);
    wrap.appendChild(inner);

    inner.addEventListener('mouseenter', () => {
      resizeHandle.classList.remove('none');
      moveHandle.classList.remove('none');
      deleteHandle.classList.remove('none');
    });

    inner.addEventListener('mouseleave', () => {
      resizeHandle.classList.add('none');
      moveHandle.classList.add('none');
      deleteHandle.classList.add('none');
    });

    this.grid.appendChild(wrap);

    this._setupDrag(wrap, inner);
    this._setupResize(resizeHandle, wrap, inner, el);

    this._items.push({ wrap, el });
    return wrap;
  }

  _applyPosition(wrap, el) {
    const w = parseInt(el.dataset.w || this._minW);
    const h = parseInt(el.dataset.h || this._minH);
    wrap.style.gridColumn = `span ${w}`;
    wrap.style.gridRow = `span ${h}`;
    wrap.style.width = '';
    wrap.style.height = '';
  }


  _setupDrag(wrap, inner) {

    const dragStart = (e) => {
      if (!e.explicitOriginalTarget.closest("#move-handle")) {
        e.preventDefault();
        return;
      }

      setTimeout(() => {
        inner.classList.add('none');
      }, 0);

      document.addEventListener('dragover', dragOver);
      document.addEventListener('dragend', dragEnd);
      document.addEventListener('drop', drop);
    }

    const dragOver = (e) => {
      e.preventDefault();
      if (this.dragTimeout) {
        clearTimeout(this.dragTimeout);
      }
      this.dragTimeout = setTimeout(() => {
        e.preventDefault();
        const target = e.originalTarget.closest('.item-wrapper');
        console.log('Drag over', e);
        if (target){
          if (target !== wrap) {
            console.log('Colliding with:', target);
            const rect = target.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            if (e.clientX < midX) {
              this.grid.insertBefore(wrap, target);
            } else {
              this.grid.insertBefore(wrap, target.nextSibling);}
          }
        } else {
          console.log('Not colliding with any item');
        }
      }, 100);

    }


    const dragEnd = (e) => {
      e.preventDefault();
      inner.classList.remove('none');
      document.removeEventListener('dragover', dragOver);
      document.removeEventListener('dragend', dragEnd);
      document.removeEventListener('drop', drop);
    }

    const drop = (e) => {
      e.preventDefault();
      inner.classList.remove('none');
      document.removeEventListener('dragover', dragOver);
      document.removeEventListener('dragend', dragEnd);
      document.removeEventListener('drop', drop);
    }


    inner.addEventListener('dragstart', dragStart);


  }


  _setupResize(handle, wrap, inner, el) {

    const onMove = (e) => {
        const rect = wrap.getBoundingClientRect();
        const startX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const startY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        const deltaX = startX - rect.right;
        const deltaY = startY - rect.bottom;
        inner.style.width = rect.width + deltaX + 'px';
        inner.style.height = rect.height + deltaY + 'px';

      if(this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {      
        const colNumber = Math.ceil(inner.offsetWidth / this.getColumnWidth(false));
        const rowNumber = Math.ceil(inner.offsetHeight / this.getColumnWidth(false));
        el.dataset.w = Math.min(colNumber, this._maxW);
        el.dataset.h = Math.min(rowNumber, this._maxH);
        this._applyPosition(wrap, el);
      }, 200);
        
    };

    const onUp = () => {
      inner.style.width = '';
      inner.style.height = '';
      inner.removeAttribute('resizing');
      wrap.removeAttribute('resizing');
      this.grid.removeEventListener('mousemove', onMove);
      this.grid.removeEventListener('mouseup', onUp);
      this.grid.removeEventListener('touchmove', onMove);
      this.grid.removeEventListener('touchend', onUp);
    };

    const onStart = (e) => {
      e.stopPropagation();
      e.preventDefault();
      inner.setAttribute('resizing', '');
      wrap.setAttribute('resizing', '');
      this.grid.addEventListener('mousemove', onMove);
      this.grid.addEventListener('mouseup', onUp);
      this.grid.addEventListener('touchmove', onMove, { passive: false });
      this.grid.addEventListener('touchend', onUp);
    }

    handle.addEventListener('touchstart', onStart, { passive: false });
    handle.addEventListener('mousedown', onStart);
  }
}

customElements.define('antro-grid', AntroGrid);

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// function throttle(func, limit) {
//   let inThrottle;
//   return function(...args) {
//     if (!inThrottle) {
//       func.apply(this, args);
//       inThrottle = true;
//       setTimeout(() => inThrottle = false, limit);
//     }
//   };
// }

function tryParseJson(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}