import os

import streamlit as st
from openai import OpenAI

SECTIONS = [
    "Business model",
    "Competitors",
    "Growth drivers",
    "Financial observations",
    "Risks",
    "Investment perspective",
]


st.set_page_config(page_title="AI Investment Research", page_icon="📈", layout="centered")

st.title("📈 AI Investment Research")
st.caption("Generate a quick, structured investment research summary for any company.")

with st.sidebar:
    st.subheader("Settings")
    st.write("Set `OPENAI_API_KEY` in your environment before running the app.")
    model = st.selectbox("Model", ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"], index=0)

company_name = st.text_input("Company name", placeholder="e.g., NVIDIA")
run = st.button("Generate summary", type="primary", use_container_width=True)


def build_prompt(company: str) -> str:
    sections = "\n".join(f"{i + 1}. {name}" for i, name in enumerate(SECTIONS))
    return (
        "You are an equity research assistant. Create a concise investment research summary "
        f"for {company}. Use exactly these sections and headings:\n{sections}\n\n"
        "Guidelines:\n"
        "- Keep each section to 3-5 bullets.\n"
        "- Be balanced, specific, and avoid hype.\n"
        "- If unsure, state assumptions clearly.\n"
        "- This is educational content, not financial advice."
    )


if run:
    if not company_name.strip():
        st.warning("Please enter a company name.")
    elif not os.getenv("OPENAI_API_KEY"):
        st.error("Missing OPENAI_API_KEY. Add it to your environment and try again.")
    else:
        try:
            client = OpenAI()
            prompt = build_prompt(company_name.strip())

            with st.spinner("Researching company..."):
                response = client.responses.create(
                    model=model,
                    input=prompt,
                    temperature=0.3,
                )

            st.success(f"Summary generated for {company_name.strip()}.")
            st.markdown(response.output_text)
            st.info("⚠️ This output is AI-generated and should not be considered investment advice.")
        except Exception as exc:
            st.error(f"Unable to generate summary: {exc}")
