#include <iostream>
#include <string>
#include <sstream>
#include <cmath>
#include <cstdlib>
#include <ctime>
#include <thread>
#include <chrono>
#include <atomic>
#include <mutex>
#include <stdexcept>

// ---------------------------------------------------------------------------
// Spacecraft State Machine
// ---------------------------------------------------------------------------
enum class SpacecraftState {
    BOOT,
    NOMINAL,
    SAFE_MODE,
    FAULT
};

std::string stateToString(SpacecraftState s) {
    switch (s) {
        case SpacecraftState::BOOT:      return "BOOT";
        case SpacecraftState::NOMINAL:   return "NOMINAL";
        case SpacecraftState::SAFE_MODE: return "SAFE_MODE";
        case SpacecraftState::FAULT:     return "FAULT";
    }
    return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Sensor Simulator
// Produces deterministic-ish values with small injected noise,
// mimicking real telemetry sampling.
// ---------------------------------------------------------------------------
struct SensorData {
    double temperature_c;      // Internal board temperature
    double pressure_kpa;       // Thruster tank pressure
    double battery_voltage;    // Bus voltage (V)
    double attitude_deg;       // Yaw angle (deg, wraps 0-360)
    long   timestamp_ms;       // Mission elapsed time
};

class SensorSimulator {
public:
    SensorSimulator() : tick_(0) { std::srand(42); }

    SensorData sample(SpacecraftState state) {
        ++tick_;
        auto noise = [](){ return ((std::rand() % 200) - 100) / 1000.0; };

        SensorData d;
        d.timestamp_ms   = tick_ * 1000;
        d.temperature_c  = baseTemp(state)  + noise() * 3.0;
        d.pressure_kpa   = basePressure(state) + noise() * 2.0;
        d.battery_voltage= baseVoltage(state) + noise() * 0.05;
        d.attitude_deg   = std::fmod(tick_ * 1.5, 360.0);
        return d;
    }

private:
    long tick_;

    double baseTemp(SpacecraftState s) {
        switch (s) {
            case SpacecraftState::BOOT:      return 22.0;
            case SpacecraftState::NOMINAL:   return 28.0;
            case SpacecraftState::SAFE_MODE: return 18.0;
            case SpacecraftState::FAULT:     return 55.0;  // overheating
        }
        return 25.0;
    }
    double basePressure(SpacecraftState s) {
        switch (s) {
            case SpacecraftState::BOOT:      return 101.0;
            case SpacecraftState::NOMINAL:   return 98.5;
            case SpacecraftState::SAFE_MODE: return 95.0;
            case SpacecraftState::FAULT:     return 70.0;  // low pressure
        }
        return 100.0;
    }
    double baseVoltage(SpacecraftState s) {
        switch (s) {
            case SpacecraftState::BOOT:      return 28.0;
            case SpacecraftState::NOMINAL:   return 27.8;
            case SpacecraftState::SAFE_MODE: return 26.5;
            case SpacecraftState::FAULT:     return 24.2;  // degraded
        }
        return 28.0;
    }
};

// ---------------------------------------------------------------------------
// Command Dispatcher
// Reads lines from stdin and triggers state transitions.
// ---------------------------------------------------------------------------
class CommandDispatcher {
public:
    explicit CommandDispatcher(std::atomic<SpacecraftState>& state,
                               std::atomic<bool>& running,
                               std::mutex& log_mutex)
        : state_(state), running_(running), log_mutex_(log_mutex) {}

    // Runs in its own thread; blocks on stdin.
    void run() {
        std::string line;
        while (running_ && std::getline(std::cin, line)) {
            dispatch(line);
        }
    }

private:
    std::atomic<SpacecraftState>& state_;
    std::atomic<bool>&            running_;
    std::mutex&                   log_mutex_;

    void dispatch(const std::string& cmd) {
        std::string result;
        if (cmd == "SET_MODE NOMINAL") {
            state_ = SpacecraftState::NOMINAL;
            result = "ACK SET_MODE NOMINAL";
        } else if (cmd == "SET_MODE SAFE_MODE") {
            state_ = SpacecraftState::SAFE_MODE;
            result = "ACK SET_MODE SAFE_MODE";
        } else if (cmd == "SET_MODE FAULT") {
            state_ = SpacecraftState::FAULT;
            result = "ACK SET_MODE FAULT";
        } else if (cmd == "RESET") {
            state_ = SpacecraftState::BOOT;
            result = "ACK RESET -> BOOT";
        } else if (cmd == "PING") {
            result = "PONG";
        } else if (cmd == "SHUTDOWN") {
            running_ = false;
            result = "ACK SHUTDOWN";
        } else {
            result = "NACK UNKNOWN_CMD " + cmd;
        }
        // Emit a CMD log line so the backend can surface it
        std::lock_guard<std::mutex> lock(log_mutex_);
        std::cout << "{\"type\":\"cmd\",\"result\":\"" << result << "\"}\n";
        std::cout.flush();
    }
};

// ---------------------------------------------------------------------------
// Telemetry Emitter
// Serialises SensorData to a single JSON line on stdout.
// ---------------------------------------------------------------------------
void emitTelemetry(const SensorData& d, SpacecraftState s) {
    std::ostringstream oss;
    oss << std::fixed;
    oss.precision(2);
    oss << "{"
        << "\"type\":\"telemetry\","
        << "\"timestamp_ms\":" << d.timestamp_ms << ","
        << "\"state\":\"" << stateToString(s) << "\","
        << "\"temperature_c\":"   << d.temperature_c   << ","
        << "\"pressure_kpa\":"    << d.pressure_kpa    << ","
        << "\"battery_voltage\":" << d.battery_voltage << ","
        << "\"attitude_deg\":"    << d.attitude_deg
        << "}";
    std::cout << oss.str() << "\n";
    std::cout.flush();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
int main() {
    std::atomic<SpacecraftState> state{SpacecraftState::BOOT};
    std::atomic<bool>            running{true};
    std::mutex                   log_mutex;

    SensorSimulator   sensors;
    CommandDispatcher dispatcher(state, running, log_mutex);

    // Auto-advance from BOOT to NOMINAL after 3 s
    std::thread bootThread([&](){
        std::this_thread::sleep_for(std::chrono::seconds(3));
        if (state == SpacecraftState::BOOT) {
            state = SpacecraftState::NOMINAL;
            std::lock_guard<std::mutex> lock(log_mutex);
            std::cout << "{\"type\":\"cmd\",\"result\":\"AUTO BOOT->NOMINAL\"}\n";
            std::cout.flush();
        }
    });

    // Command reader thread
    std::thread cmdThread([&](){ dispatcher.run(); });

    // Main telemetry loop — emits every 1 s
    while (running) {
        SpacecraftState current = state.load();
        SensorData data = sensors.sample(current);
        {
            std::lock_guard<std::mutex> lock(log_mutex);
            emitTelemetry(data, current);
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    }

    bootThread.join();
    cmdThread.join();
    return 0;
}
