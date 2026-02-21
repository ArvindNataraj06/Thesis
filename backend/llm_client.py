from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)