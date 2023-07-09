# Local LLM Integration with `text-web-ui` :llama:

Integrate local Large Language Models (LLMs) using
[oobabooga/text-generation-webui](https://github.com/oobabooga/text-generation-webui),
a specialized interface that incorporates a custom variant of the OpenAI API for a seamless integration experience.

`text-generation-webui` is a versatile tool for implementing and operating Large Language Models.

## Implementation Components

Implementation of local LLMs requires the following components:

* `text-generation-webui`: an interactive Gradio web UI built for running Large Language Models.
* `Local Large Language Models`: Please follow the guide provided for this step.
* `big-AGI`: a client for LLM integrations, offering features such as Personas, Code Execution, Voice Support, AGI
  functions, and more.

## Setup Instructions

This guide presumes that `big-AGI` is already installed on your system.

1. [Install text-generation-webui](https://github.com/oobabooga/text-generation-webui#Installation)
    - You can use the _one-click installer_ for Windows, Mac, and Linux (10 minutes)
2. Install the dependencies for the **openai extension**:
    - Open a terminal in the folder `text-generation-webui/extensions/openai`
    - Run the following command: `pip install -r requirements.txt`
3. Update the start script to include the `openai` extension:
    - Navigate back to the directory containing `webui.py`
    - Open `webui.py`
    - Modify `CMD_FLAGS` to: `CMD_FLAGS = '--chat --listen --extensions openai'`
4. Run the start script in the terminal:
    - `./webui.py`
    - You should see `OPENAI_API_BASE=http://0.0.0.0:5001/v1`
5. Open `big-AGI`, and configure as follows:
    - Add a source of type `Oobabooga`
    - Enter the address `http://127.0.0.1:5001` if running on localhost (if `text-web-ui` server is operating on a
      different networked computer, change the address from `0.0.0.0` to the server's IP)
6. Update the models, and start chatting

Experience the privacy and flexibility of local LLM integration with `text-web-ui` and `big-AGI`! :tada:
