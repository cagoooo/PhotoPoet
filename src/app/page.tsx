          {poem && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold tracking-tight mt-4 text-center rainbow-text">AI 詠唱，詩意流淌：</h2>
                <div className="mt-2 min-h-[150px] rounded-md shadow-sm resize-none multicolored-poem">
                  {poem.split('\n').map((line, index) => (
                    <span key={index} className="poem-line">
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}