# Minimal AI Investment Research App

A simple Streamlit app that generates a structured investment research summary for a company using the OpenAI API.

## Features

- Enter a company name
- Generate an AI investment research summary with these sections:
  1. Business model
  2. Competitors
  3. Growth drivers
  4. Financial observations
  5. Risks
  6. Investment perspective
- Clean, minimal interface

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your_api_key_here"
```

## Run

```bash
streamlit run app.py
```

Then open the local URL shown in your terminal.

## Notes

- This tool is for educational research support only.
- It does **not** provide financial advice.
