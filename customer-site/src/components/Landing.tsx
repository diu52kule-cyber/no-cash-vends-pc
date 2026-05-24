type Props = {
  Logo: (p: { size?: number }) => JSX.Element;
  outletName: string;
  tagline: string;
  tableNumber: number;
  onBegin: () => void;
};

export function Landing({ Logo, outletName, tagline, tableNumber, onBegin }: Props) {
  return (
    <div className="landing">
      <div className="logo-wrap"><Logo size={120} /></div>
      <div className="stripes"><span /><span /><span /></div>
      <h1>{outletName}</h1>
      <div className="sub">{tagline}</div>
      <div className="table-chip"><span className="dot" /> Table {tableNumber}</div>
      <button className="cta" onClick={onBegin}>Tap to begin</button>
    </div>
  );
}
