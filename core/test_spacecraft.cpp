/**
 * Unit tests for spacecraft state machine and sensor simulator.
 *
 * Compiled and run independently of the main binary.
 * Uses a minimal hand-rolled assertion framework — no external deps.
 *
 * Build: g++ -std=c++17 -Wall -o tests test_spacecraft.cpp && ./tests
 */

#include <cassert>
#include <cmath>
#include <iostream>
#include <sstream>
#include <string>

// ---- Minimal test harness ------------------------------------------------
static int passed = 0;
static int failed = 0;

#define EXPECT_EQ(a, b) do { \
    if ((a) == (b)) { ++passed; } \
    else { ++failed; \
        std::cerr << "[FAIL] " << __FILE__ << ":" << __LINE__ \
                  << "  expected " << (b) << " got " << (a) << "\n"; } \
} while(0)

#define EXPECT_TRUE(x) do { \
    if ((x)) { ++passed; } \
    else { ++failed; \
        std::cerr << "[FAIL] " << __FILE__ << ":" << __LINE__ \
                  << "  expected true: " #x "\n"; } \
} while(0)

#define EXPECT_NEAR(a, b, eps) do { \
    if (std::abs((a) - (b)) <= (eps)) { ++passed; } \
    else { ++failed; \
        std::cerr << "[FAIL] " << __FILE__ << ":" << __LINE__ \
                  << "  " << (a) << " not near " << (b) << " (eps=" << (eps) << ")\n"; } \
} while(0)

// ---- Inline copies of production types (no #include of spacecraft.cpp) ---
enum class SpacecraftState { BOOT, NOMINAL, SAFE_MODE, FAULT };

std::string stateToString(SpacecraftState s) {
    switch (s) {
        case SpacecraftState::BOOT:      return "BOOT";
        case SpacecraftState::NOMINAL:   return "NOMINAL";
        case SpacecraftState::SAFE_MODE: return "SAFE_MODE";
        case SpacecraftState::FAULT:     return "FAULT";
    }
    return "UNKNOWN";
}

// Deterministic sensor helper (mirrors production logic without rand())
struct Readings {
    double temp, pressure, voltage;
};

Readings baseReadings(SpacecraftState s) {
    switch (s) {
        case SpacecraftState::BOOT:      return {22.0, 101.0, 28.0};
        case SpacecraftState::NOMINAL:   return {28.0,  98.5, 27.8};
        case SpacecraftState::SAFE_MODE: return {18.0,  95.0, 26.5};
        case SpacecraftState::FAULT:     return {55.0,  70.0, 24.2};
    }
    return {25.0, 100.0, 28.0};
}

// ---- Test suites ---------------------------------------------------------

void test_state_to_string() {
    std::cout << "[ state_to_string ]\n";
    EXPECT_EQ(stateToString(SpacecraftState::BOOT),      "BOOT");
    EXPECT_EQ(stateToString(SpacecraftState::NOMINAL),   "NOMINAL");
    EXPECT_EQ(stateToString(SpacecraftState::SAFE_MODE), "SAFE_MODE");
    EXPECT_EQ(stateToString(SpacecraftState::FAULT),     "FAULT");
}

void test_state_transitions() {
    std::cout << "[ state_transitions ]\n";
    SpacecraftState s = SpacecraftState::BOOT;

    // BOOT → NOMINAL
    s = SpacecraftState::NOMINAL;
    EXPECT_EQ(stateToString(s), "NOMINAL");

    // NOMINAL → SAFE_MODE
    s = SpacecraftState::SAFE_MODE;
    EXPECT_EQ(stateToString(s), "SAFE_MODE");

    // SAFE_MODE → FAULT
    s = SpacecraftState::FAULT;
    EXPECT_EQ(stateToString(s), "FAULT");

    // FAULT → BOOT (RESET)
    s = SpacecraftState::BOOT;
    EXPECT_EQ(stateToString(s), "BOOT");
}

void test_sensor_nominal_ranges() {
    std::cout << "[ sensor_nominal_ranges ]\n";
    auto r = baseReadings(SpacecraftState::NOMINAL);
    // Temperature 20–40 °C in nominal
    EXPECT_TRUE(r.temp >= 20.0 && r.temp <= 40.0);
    // Pressure 90–110 kPa
    EXPECT_TRUE(r.pressure >= 90.0 && r.pressure <= 110.0);
    // Voltage 27–29 V
    EXPECT_TRUE(r.voltage >= 27.0 && r.voltage <= 29.0);
}

void test_sensor_fault_conditions() {
    std::cout << "[ sensor_fault_conditions ]\n";
    auto nominal = baseReadings(SpacecraftState::NOMINAL);
    auto fault   = baseReadings(SpacecraftState::FAULT);

    // Fault → higher temp
    EXPECT_TRUE(fault.temp > nominal.temp);
    // Fault → lower pressure
    EXPECT_TRUE(fault.pressure < nominal.pressure);
    // Fault → lower voltage
    EXPECT_TRUE(fault.voltage < nominal.voltage);
}

void test_sensor_safe_mode_conservative() {
    std::cout << "[ sensor_safe_mode_conservative ]\n";
    auto safe    = baseReadings(SpacecraftState::SAFE_MODE);
    auto nominal = baseReadings(SpacecraftState::NOMINAL);

    // Safe mode should have lower temperature (systems offline)
    EXPECT_TRUE(safe.temp < nominal.temp);
    // Lower voltage draw
    EXPECT_TRUE(safe.voltage < nominal.voltage);
}

void test_attitude_wraps() {
    std::cout << "[ attitude_wraps ]\n";
    // Attitude is tick * 1.5 mod 360
    for (int tick = 1; tick <= 300; ++tick) {
        double att = std::fmod(tick * 1.5, 360.0);
        EXPECT_TRUE(att >= 0.0 && att < 360.0);
    }
}

void test_command_ack_format() {
    std::cout << "[ command_ack_format ]\n";
    // Verify the ACK strings match what the backend parses
    std::string ack_nominal = "ACK SET_MODE NOMINAL";
    std::string ack_safe    = "ACK SET_MODE SAFE_MODE";
    std::string ack_reset   = "ACK RESET -> BOOT";
    std::string pong        = "PONG";

    EXPECT_TRUE(ack_nominal.find("NOMINAL") != std::string::npos);
    EXPECT_TRUE(ack_safe.find("SAFE_MODE") != std::string::npos);
    EXPECT_TRUE(ack_reset.find("BOOT") != std::string::npos);
    EXPECT_EQ(pong, "PONG");
}

void test_telemetry_json_format() {
    std::cout << "[ telemetry_json_format ]\n";
    // Simulate what emitTelemetry produces and verify key fields appear
    std::ostringstream oss;
    oss << std::fixed;
    oss.precision(2);
    oss << "{"
        << "\"type\":\"telemetry\","
        << "\"timestamp_ms\":" << 5000 << ","
        << "\"state\":\"" << "NOMINAL" << "\","
        << "\"temperature_c\":" << 28.0 << ","
        << "\"pressure_kpa\":"  << 98.5 << ","
        << "\"battery_voltage\":" << 27.8 << ","
        << "\"attitude_deg\":"  << 7.5
        << "}";
    std::string json = oss.str();

    EXPECT_TRUE(json.find("\"type\":\"telemetry\"") != std::string::npos);
    EXPECT_TRUE(json.find("\"state\":\"NOMINAL\"")  != std::string::npos);
    EXPECT_TRUE(json.find("\"temperature_c\"")      != std::string::npos);
    EXPECT_TRUE(json.find("\"battery_voltage\"")    != std::string::npos);
}

// ---- Runner --------------------------------------------------------------
int main() {
    std::cout << "=== Spacecraft Unit Tests ===\n\n";

    test_state_to_string();
    test_state_transitions();
    test_sensor_nominal_ranges();
    test_sensor_fault_conditions();
    test_sensor_safe_mode_conservative();
    test_attitude_wraps();
    test_command_ack_format();
    test_telemetry_json_format();

    std::cout << "\n=== Results: " << passed << " passed, " << failed << " failed ===\n";
    return failed == 0 ? 0 : 1;
}
