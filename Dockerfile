# LibAV.js Build Environment
# Based on Yahweasel/libav.js v6.5.7.1 with paulrouget patches

FROM ubuntu:22.04

# Set non-interactive mode for apt
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    python3 \
    python3-pip \
    nodejs \
    npm \
    autoconf \
    automake \
    libtool \
    pkg-config \
    cmake \
    nasm \
    yasm \
    && rm -rf /var/lib/apt/lists/*

# Install Emscripten
WORKDIR /opt
RUN git clone https://github.com/emscripten-core/emsdk.git
WORKDIR /opt/emsdk
RUN ./emsdk install 3.1.70 && ./emsdk activate 3.1.70
ENV PATH="/opt/emsdk:/opt/emsdk/upstream/emscripten:/opt/emsdk/node/16.20.0_64bit/bin:${PATH}"
RUN bash -c "source /opt/emsdk/emsdk_env.sh"

# Set working directory
WORKDIR /libav.js

# Copy the patched source code (the entire repo)
COPY . .

# Install Node.js dependencies
RUN npm install

# Build command - build h264-aac-mp3 variant
CMD ["make", "build-h264-aac-mp3"]
