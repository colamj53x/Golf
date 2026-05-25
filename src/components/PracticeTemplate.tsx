import { DEFAULT_4H_PRACTICE_METRICS } from '@/types/practice';

const categoryLabels: Record<string, string> = {
  distance: 'Distance',
  ball_flight: 'Ball Flight',
  dispersion: 'Dispersion',
  swing: 'Swing',
  tempo: 'Tempo',
};

const categoryOrder = ['distance', 'ball_flight', 'dispersion', 'swing', 'tempo'];

export function PracticeTemplate() {
  const metricsByCategory = DEFAULT_4H_PRACTICE_METRICS.reduce((acc, metric) => {
    if (!acc[metric.category]) acc[metric.category] = [];
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, typeof DEFAULT_4H_PRACTICE_METRICS>);

  return (
    <div className="p-8 bg-white text-black min-h-screen print:p-4">
      <style>
        {`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
        `}
      </style>
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold mb-1">Practice Session Data Entry Template</h1>
          <p className="text-sm text-gray-600">4-Hybrid Practice Metrics</p>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-4 gap-4 mb-6 border border-gray-300 p-4 rounded">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
            <div className="border-b border-gray-400 h-6"></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Club</label>
            <div className="border-b border-gray-400 h-6">4H</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Total Shots</label>
            <div className="border-b border-gray-400 h-6"></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Best Shots (Both in Range)</label>
            <div className="border-b border-gray-400 h-6"></div>
          </div>
        </div>

        {/* Metrics Table */}
        {categoryOrder.map((category) => (
          <div key={category} className="mb-6">
            <h2 className="text-lg font-bold bg-gray-200 px-3 py-2 rounded-t border border-gray-300">
              {categoryLabels[category]}
            </h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold w-1/4">Metric</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold w-1/6">Target</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold w-1/5">Your Value (Min-Max)</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold w-1/6">Shots in Range</th>
                  <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold w-1/8">Unit</th>
                </tr>
              </thead>
              <tbody>
                {metricsByCategory[category]?.map((metric) => (
                  <tr key={metric.id}>
                    <td className="border border-gray-300 px-3 py-2 text-sm">{metric.metricName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-sm font-mono">
                      {metric.targetDisplay}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <div className="h-5"></div>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <div className="h-5"></div>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-600">
                      {metric.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Notes Section */}
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 px-3 py-2 rounded-t border border-gray-300">
            Session Notes
          </h2>
          <div className="border border-gray-300 border-t-0 p-3 min-h-24">
            <div className="border-b border-gray-300 h-6 mb-2"></div>
            <div className="border-b border-gray-300 h-6 mb-2"></div>
            <div className="border-b border-gray-300 h-6"></div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-500 text-center mt-8">
          <p>Enter single values or ranges (e.g., "120-125" for min-max). Leave blank if not measured.</p>
        </div>

        {/* Print Button - hidden when printing */}
        <div className="no-print mt-8 text-center">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
