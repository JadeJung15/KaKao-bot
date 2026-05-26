import React from "react";
import { statusTone } from "./domain.js";

export function StatusBadge({ label, status, tone }) {
  return <span className={`console-status console-status-${tone || statusTone(status)}`}>{label || status || "확인"}</span>;
}

export function SummaryGrid({ items = [] }) {
  return (
    <section className="console-summary-grid" aria-label="요약">
      {items.map((item) => (
        <article className={`console-summary-card console-summary-${item.tone || "neutral"}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.help ? <small>{item.help}</small> : null}
        </article>
      ))}
    </section>
  );
}

export function Toolbar({ search, onSearch, filter, onFilter, actions }) {
  return (
    <div className="console-toolbar">
      <label className="console-search">
        <span>검색</span>
        <input value={search || ""} onChange={(event) => onSearch?.(event.target.value)} placeholder="방명, 신청자, 상태 검색" />
      </label>
      {onFilter ? (
        <label className="console-filter">
          <span>상태</span>
          <select value={filter || "all"} onChange={(event) => onFilter(event.target.value)}>
            <option value="all">전체</option>
            <option value="active">운영 중</option>
            <option value="pending">확인 필요</option>
            <option value="archived">종료 보관</option>
          </select>
        </label>
      ) : null}
      <div className="console-toolbar-actions">{actions}</div>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="console-empty">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function ToastHost({ message, tone = "neutral", onClose }) {
  if (!message) return null;
  return (
    <div className={`console-toast console-toast-${tone}`} role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose}>닫기</button>
    </div>
  );
}

export function DetailTabs({ tabs = [], current, onChange }) {
  return (
    <div className="console-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          type="button"
          className={tab.id === current ? "active" : ""}
          key={tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function FieldRow({ label, children }) {
  return (
    <div className="console-field-row">
      <span>{label}</span>
      <strong>{children || "-"}</strong>
    </div>
  );
}
