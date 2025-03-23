import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // You'll need to create this CSS file

function App() {
  const [file, setFile] = useState(null);
  const [uiDescription, setUiDescription] = useState("");
  const [angularCode, setAngularCode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const API_URL = "http://127.0.0.1:8000"; // Change this if your backend is on a different URL

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");

      // Create a preview URL for the image
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please upload a design file!");
      return;
    }

    setIsLoading(true);
    setError("");
    setUiDescription("");
    setAngularCode(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/generate-code/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUiDescription(response.data.ui_description);
      setAngularCode(response.data.angular_code);
    } catch (error) {
      console.error("Error generating code:", error);
      setError(
        error.response?.data?.detail ||
          "Error connecting to the backend. Make sure your backend server is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Design to Angular Code Generator</h1>
        <p>Upload a UI design image to generate Angular components</p>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <div className="card">
            <h2>Upload Design</h2>
            <div className="file-upload-container">
              <div className="file-input-wrapper">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  id="design-upload"
                  className="file-input"
                />
                <label htmlFor="design-upload" className="upload-label">
                  {file ? file.name : "Choose Design File"}
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={isLoading || !file}
                className="upload-button"
              >
                {isLoading ? "Processing..." : "Generate Code"}
              </button>
            </div>

            {preview && (
              <div className="image-preview">
                <h3>Design Preview</h3>
                <img src={preview} alt="Design preview" />
              </div>
            )}
          </div>
        </section>
        {error && (
          <div className="error-message">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
          </div>
        )}
        {isLoading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">
              Analyzing design and generating code...
            </p>
            <p className="loading-subtext">
              This may take 1-2 minutes depending on your system's performance
            </p>
          </div>
        )}
        {uiDescription && (
          <section className="result-section">
            <div className="card">
              <h2>UI Description</h2>
              <div className="description-container">
                <pre className="ui-description">{uiDescription}</pre>
              </div>
            </div>
          </section>
        )}
        {angularCode && (
          <section className="result-section">
            <div className="card">
              <h2>Generated Angular Code</h2>

              <div className="download-buttons">
                <button
                  onClick={() => {
                    const blob = new Blob([angularCode.ts_file], {
                      type: "text/plain",
                    });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "component.ts";
                    link.click();
                  }}
                  className="download-button"
                >
                  Download TypeScript (.ts)
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([angularCode.html_file], {
                      type: "text/plain",
                    });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "component.html";
                    link.click();
                  }}
                  className="download-button"
                >
                  Download HTML Template
                </button>

                {angularCode.scss_file && (
                  <button
                    onClick={() => {
                      const blob = new Blob([angularCode.scss_file], {
                        type: "text/plain",
                      });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.download = "component.scss";
                      link.click();
                    }}
                    className="download-button"
                  >
                    Download SCSS Styles
                  </button>
                )}
              </div>

              <div className="code-container">
                <div className="code-section">
                  <h3>TypeScript Component</h3>
                  <pre className="code-block typescript">
                    {angularCode.ts_file}
                  </pre>
                </div>

                {angularCode.html_file && (
                  <div className="code-section">
                    <h3>HTML Template</h3>
                    <pre className="code-block html">
                      {angularCode.html_file}
                    </pre>
                  </div>
                )}

                {angularCode.scss_file && (
                  <div className="code-section">
                    <h3>SCSS Styles</h3>
                    <pre className="code-block scss">
                      {angularCode.scss_file}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="app-footer">
        <p>Design to Code Generator &copy; 2025</p>
      </footer>
    </div>
  );
}

export default App;
