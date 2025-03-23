from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import base64
import requests   # first open terminal - ollama pull deepseek-coder then ollama pull llava
import json       # open vs code terminal(navigate to cd figma_angular) then - uvicorn main:app --reload
import shutil     # open another vs code terminal parallely (navigate to cd figma_angular) then - npm start  
import time,re
   
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Backend is running!"}

def format_angular_code(raw_code):
    # Initialize result structure
    result = {
        "raw": raw_code,
        "formatted": "",
        "ts_file": "",
        "html_file": "",
        "scss_file": ""
    }
    
    # Extract TypeScript code
    ts_pattern = "```typescript\n(.*?)```"
    ts_match = re.search(ts_pattern, raw_code, re.DOTALL)
    if ts_match:
        result["ts_file"] = ts_match.group(1).strip()
    
    # Extract HTML code
    html_pattern = "```html\n(.*?)```"
    html_match = re.search(html_pattern, raw_code, re.DOTALL)
    if html_match:
        result["html_file"] = html_match.group(1).strip()
    
    # Extract SCSS code
    scss_pattern = "```scss\n(.*?)```"
    scss_match = re.search(scss_pattern, raw_code, re.DOTALL)
    if scss_match:
        result["scss_file"] = scss_match.group(1).strip()
    
    # If we couldn't parse properly, try to clean up the whole response
    if not result["ts_file"] and not result["html_file"]:
        # Remove any prose text and just keep code sections
        code_blocks = re.findall(r"```(?:typescript|html|scss)?\n(.*?)```", raw_code, re.DOTALL)
        if code_blocks:
            result["formatted"] = "\n\n".join(block.strip() for block in code_blocks)
        else:
            # If still no code blocks found, just clean up markdown markers
            cleaned_code = raw_code.replace("```typescript", "").replace("```ts", "")
            cleaned_code = cleaned_code.replace("```html", "").replace("```scss", "").replace("```", "")
            result["formatted"] = cleaned_code.strip()
            result["ts_file"] = cleaned_code.strip()
    else:
        # Combine the extracted code files
        result["formatted"] = "\n\n".join(filter(None, [result["ts_file"], result["html_file"], result["scss_file"]]))
    
    return result

# Function to call Ollama API
def call_ollama_api(model, prompt, image_path=None, max_retries=3, temperature=0.7):
    url = "http://localhost:11434/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,  # Complete response at once
        "temperature": temperature  # Lower temperature for more deterministic output
    }
    
    # Add image if provided
    if image_path:
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        payload["images"] = [base64_image]
    
    retries = 0
    while retries < max_retries:
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            if "response" in response_data:
                return response_data["response"]
            else:
                return response.text
        except Exception as e:
            retries += 1
            if retries == max_retries:
                raise Exception(f"Ollama API error after {max_retries} attempts: {str(e)}")
            time.sleep(2)  # Wait before retrying
    
    return "Error: Failed to get response from Ollama API"

# Upload Design File & Generate Code
@app.post("/generate-code/")
async def generate_code(file: UploadFile = File(...)):
    file_path = None
    
    try:
        # Create uploads directory if it doesn't exist
        os.makedirs("uploads", exist_ok=True)
        
        # Save the uploaded file temporarily
        file_path = os.path.join("uploads", file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Step 1: Use LLaVA to describe the UI
        try:
            ui_prompt = """
                You are a professional UI/UX designer tasked with analyzing a UI design image.
                Create a STRUCTURED, TECHNICAL DESCRIPTION that a developer can easily use to implement this design.

                Focus on these aspects:
                1. LAYOUT: Exact structure (grid, flex) with specific spacing values
                2. COMPONENTS: All UI elements with their properties (size, position, text)
                3. COLORS: Hex codes for all colors used (background, text, buttons)
                4. TYPOGRAPHY: Font families, sizes, weights, and line heights
                5. INTERACTIONS: Expected behavior for interactive elements

                FORMAT YOUR RESPONSE AS A STRUCTURED SPECIFICATION LIST WITH HIERARCHICAL SECTIONS.
                INCLUDE TECHNICAL DETAILS A DEVELOPER NEEDS, NOT GENERAL DESCRIPTIONS.
            """
            
            ui_description = call_ollama_api(
                model="llava",
                prompt=ui_prompt,
                image_path=file_path,
                temperature=0.3
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error with LLaVA: {str(e)}")
        
        # Step 2: Use DeepSeek Coder to generate Angular code
        try:
            code_prompt = f"""
                You are an Angular developer tasked with implementing a UI exactly as specified. 
                DO NOT EXPLAIN THE CODE OR PROVIDE EXPLANATIONS - JUST WRITE THE ACTUAL IMPLEMENTATION CODE.

                TECHNICAL SPECIFICATIONS:
                {ui_description}

                YOUR TASK:
                Generate production-ready Angular component files based on these exact specifications.

                OUTPUT FORMAT - PROVIDE ONLY THE FOLLOWING WITHOUT ANY EXPLANATIONS:
                1. TypeScript file (component.ts) - start with ```typescript, end with ```
                2. HTML template (component.html) - start with ```html, end with ```
                3. CSS styles (component.scss) - start with ```scss, end with ```

                IMPORTANT:
                - Do not include any explanations or comments outside of code blocks
                - Strictly use Angular Material components where appropriate
                - Follow Angular best practices
                - Include proper typing and form validation

                JUST GENERATE THE CODE FILES - NO EXPLANATION NEEDED.
            """
            angular_code = call_ollama_api(
                model="deepseek-coder",
                prompt=code_prompt,
                temperature=0.2
            )   
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error with DeepSeek Coder: {str(e)}")
        
        # Format the Angular code for better structure
        angular_code_formatted = format_angular_code(angular_code)
        
        return {
            "ui_description": ui_description, 
            "angular_code": angular_code_formatted
        }
    
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}\n{traceback_str}")
    finally:
        # Clean up the file after processing
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass