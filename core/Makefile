CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2 -pthread
TARGET   = spacecraft

all: $(TARGET)

$(TARGET): spacecraft.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET) spacecraft.cpp

clean:
	rm -f $(TARGET)
