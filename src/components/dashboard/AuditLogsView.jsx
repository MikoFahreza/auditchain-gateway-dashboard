import React from 'react';
import AuditLogTable from './AuditLogTable';
import StatCards from './StatCards';

function AuditLogsView(props) {
  return (
    <>
      <section className="ac-hero">
        <div className="ac-hero__pattern" />
        <div className="ac-hero__content">
          <div className="ac-hero__left">
            <span className="ac-page-kicker">Audit Trail</span>
            <h1 className="ac-hero__title">Audit Logs</h1>
            <p className="ac-hero__subtitle">
              Inspect transaction history, filter source tables, and verify blockchain integrity on demand.
            </p>
          </div>
        </div>
      </section>

      {props.stats && <StatCards stats={props.stats} />}

      <AuditLogTable {...props} />
    </>
  );
}

const MemoizedAuditLogsView = React.memo(AuditLogsView);

export { AuditLogsView };
export default MemoizedAuditLogsView;
