import React from 'react';

const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 8,
  onPageChange,
  itemLabel = 'items',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
      <p className="text-slate-500 font-medium">
        Showing <strong className="text-slate-800">{startItem}</strong> to{' '}
        <strong className="text-slate-800">{endItem}</strong> of{' '}
        <strong className="text-slate-800">{totalItems}</strong> {itemLabel}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1"
        >
          <span>←</span>
          <span>Previous</span>
        </button>

        <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 rounded-lg border border-slate-200">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1"
        >
          <span>Next</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
