interface RowHeightCacheData {
  rowHeight: number;
  rowSpacerHeight: number;
}

/**
 * This object contains the cache of the various row heights that are present inside
 * the data table.   Its based on Fenwick tree data structure that helps with
 * querying sums that have time complexity of log n.
 *
 * Fenwick Tree Credits: http://petr-mitrichev.blogspot.com/2013/05/fenwick-tree-range-updates.html
 * https://github.com/mikolalysenko/fenwick-tree
 *
 */
export class RowHeightCache {
  /**
   * Tree Array stores the cumulative information of the row heights to perform efficient
   * range queries and updates.  Currently the tree is initialized to the base row
   * height instead of the detail row height.
   */
  private treeArray: RowHeightCacheData[] = [];

  /**
   * This is used to use as a Source of truth if a Rebuild is in progress.
   */
  private swapTreeArray: RowHeightCacheData[] = null;

  /**
   * Clear the Tree array.
   */
  clearCache(): void {
    this.swapTreeArray = this.treeArray;
    this.treeArray = [];
  }

  /**
   * Initialize the Fenwick tree with row Heights.
   *
   * @param rows The array of rows which contain the expanded status.
   * @param rowHeight The row height.
   * @param detailRowHeight The detail row height.
   */
  initCache(details: any): void {
    const { rows, rowHeight, detailRowHeight, externalVirtual, rowCount, rowIndexes, rowExpansions, groupPadding, lastRowSpacerHeight } = details;
    const isFn = typeof rowHeight === 'function';
    const isDetailFn = typeof detailRowHeight === 'function';

    if (!isFn && isNaN(rowHeight)) {
      throw new Error(`Row Height cache initialization failed. Please ensure that 'rowHeight' is a
        valid number or function value: (${rowHeight}) when 'scrollbarV' is enabled.`);
    }

    // Add this additional guard in case detailRowHeight is set to 'auto' as it wont work.
    if (!isDetailFn && isNaN(detailRowHeight)) {
      throw new Error(`Row Height cache initialization failed. Please ensure that 'detailRowHeight' is a
        valid number or function value: (${detailRowHeight}) when 'scrollbarV' is enabled.`);
    }

    const n = externalVirtual ? rowCount : rows.length;
    this.treeArray = new Array(n);

    for (let i = 0; i < n; ++i) {
      this.treeArray[i] = { rowHeight: 0, rowSpacerHeight: 0 };
    }

    for (let i = 0; i < n; ++i) {
      const row = rows[i];
      let currentRowHeight = rowHeight;
      if (isFn) {
        currentRowHeight = rowHeight(row);
      }

      // Add the detail row height to the already expanded rows.
      // This is useful for the table that goes through a filter or sort.
      const expanded = rowExpansions.has(row);
      if (row && expanded) {
        if (isDetailFn) {
          const index = rowIndexes.get(row);
          currentRowHeight += detailRowHeight(row, index);
        } else {
          currentRowHeight += detailRowHeight;
        }
      }

      if (row.isRowGroup && groupPadding) {
        currentRowHeight += groupPadding;
      }
      
      if (lastRowSpacerHeight && !row.isRowGroup && (i === n -1 || rows[i + 1]?.isRowGroup)) {
        this.update(i, currentRowHeight, lastRowSpacerHeight);
      } else {
        this.update(i, currentRowHeight);
      }
    }

    this.swapTreeArray = null;
  }

  /**
   * Given the ScrollY position i.e. sum, provide the rowIndex
   * that is present in the current view port.  Below handles edge cases.
   */
  getRowIndex(scrollY: number): number {
    if (scrollY === 0) return 0;
    return this.calcRowIndex(scrollY);
  }

  /**
   * When a row is expanded or rowHeight is changed, update the height.  This can
   * be utilized in future when Angular Data table supports dynamic row heights.
   */
  update(atRowIndex: number, byRowHeight: number, spacerHeight: number = -1): void {
    let source = this.treeArray;
    if (!this.treeArray.length) {
      if (!this.swapTreeArray) {
        throw new Error(`Update at index ${atRowIndex} with value ${byRowHeight} failed:
        Row Height cache not initialized.`);
      }
      source = this.swapTreeArray;
    }

    const n = source.length;
    atRowIndex |= 0;

    while (atRowIndex < n) {
      source[atRowIndex].rowHeight += byRowHeight;
      if (spacerHeight >= 0) {
        source[atRowIndex].rowSpacerHeight = spacerHeight;
      }
      atRowIndex |= atRowIndex + 1;
    }
  }

  set(atRowIndex: number, value: number): boolean {
    const current = this.queryBetween(atRowIndex, atRowIndex);
    if (value !== current) {
      this.update(atRowIndex, value - current);
      return true;
    }
    return false;
  }

  /**
   * Range Sum query from 1 to the rowIndex
   */
  query(atIndex: number): number {
    let source = this.treeArray;
    if (!this.treeArray.length) {
      if (!this.swapTreeArray) {
        throw new Error(`query at index ${atIndex} failed: Fenwick tree array not initialized.`);
      }
      source = this.swapTreeArray;
    }

    let sum = 0;
    atIndex |= 0;

    while (atIndex >= 0) {
      sum += source[atIndex].rowHeight + source[atIndex].rowSpacerHeight;
      atIndex = (atIndex & (atIndex + 1)) - 1;
    }

    return sum;
  }

  /**
   * Find the total height between 2 row indexes
   */
  queryBetween(atIndexA: number, atIndexB: number): number {
    return this.query(atIndexB) - this.query(atIndexA - 1);
  }

  /**
   * Given the ScrollY position i.e. sum, provide the rowIndex
   * that is present in the current view port.
   */
  private calcRowIndex(sum: number): number {
    if (!this.treeArray.length) return 0;

    let pos = -1;
    const dataLength = this.treeArray.length;

    // Get the highest bit for the block size.
    const highestBit = Math.pow(2, dataLength.toString(2).length - 1);

    for (let blockSize = highestBit; blockSize !== 0; blockSize >>= 1) {
      const nextPos = pos + blockSize;
      if (nextPos < dataLength && sum >= (this.treeArray[nextPos].rowHeight + this.treeArray[nextPos].rowSpacerHeight)) {
        sum -= this.treeArray[nextPos].rowHeight - this.treeArray[nextPos].rowSpacerHeight;
        pos = nextPos;
      }
    }

    return pos + 1;
  }
}
