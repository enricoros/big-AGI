# Local LLM Integration with `text-web-ui` :llama:

Integrate local Large Language Models (LLMs) using
[oobabooga/text-generation-webui](https://github.com/oobabooga/text-generation-webui),
a specialized interface that incorporates a custom variant of the OpenAI API for a seamless integration experience.

_Last changed on Aug 8, 2023, using the CMD_FLAGS.txt file_

### Components

Implementation of local LLMs requires the following components:

* **text-generation-webui**: a python application with Gradio web UI for running Large Language Models
    * **local Large Language Models "LLMs"**: use large language models on your own computer and with consumer GPUs or CPUs
* **big-AGI**: LLM UI, offering features such as Personas, OCR, Voice Support, Code Execution, AGI functions, and more

## Instructions

This guide presumes that **big-AGI** is already installed on your system - note that the text-generation-webui IP
address must be accessible from the Server running **big-AGI**.

1. Install [text-generation-webui](https://github.com/oobabooga/text-generation-webui#Installation)
    - Download the one-click installer extract it, and double-click on "start" - 10 min
    - Then close it, as we need to change the startup flags
2. Enable the **openai extension**
    - Edit `CMD_FLAGS.txt`
    - Update the contents from `--chat` to: `--chat --listen --extensions openai`
3. Restart text-generation-webui
    - Double-click on "start"
    - You will see something like: `OpenAI compatible API ready at: OPENAI_API_BASE=http://0.0.0.0:5001/v1`
        - The OpenAI API is now running on port 5001, on both localhost (127.0.0.1) and your local IP address
4. Load your first model
    - Open the text-generation-webui at [127.0.0.1:7860](http://127.0.0.1:7860/)
    - Switch to the **Model** tab
    - Download for instance `TheBloke/Llama-2-7b-Chat-GPTQ:gptq-4bit-32g-actorder_True` - 4.3 GB
    - Select the model once loaded
5. Configure big-AGI:
    - Models > Add a model source of type: **Oobabooga**
    - Enter the address: `http://127.0.0.1:5001`
        - replace 127.0.0.1 with the IP of the machine if running remotely - make sure to use the **IP:Port** format
    - Load the models
        - the active model must be selected on the text-generation-webui, as it doesn't support model switching or parallel requests
    - Select model & Chat

Experience the privacy and flexibility of local LLMs with `big-AGI` and `text-generation-webui`! :tada:
