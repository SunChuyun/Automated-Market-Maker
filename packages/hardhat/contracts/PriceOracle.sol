// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal Chainlink-compatible interface
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract PriceOracle {
    IAggregatorV3 public immutable priceFeed;

    // Maximum allowed age of the oracle price
    uint256 public immutable maxAge;

    constructor(address _priceFeed, uint256 _maxAge) {
        require(_priceFeed != address(0), "Invalid price feed");
        require(_maxAge > 0, "Invalid max age");

        priceFeed = IAggregatorV3(_priceFeed);
        maxAge = _maxAge;
    }

    // Strict read for finalizing initial configuration and price comparisons.
    function getEthUsdPrice18() external view returns (uint256) {
        (uint256 price18, bool fresh) = getEthUsdPriceWithStatus18();
        require(fresh, "Stale oracle price");
        return price18;
    }

    // A stale / temporarily unavailable feed is not a malformed feed.
    // Report stale/unavailable as fresh=false so AMMPool can trade using
    // spot-vs-TWAP. Malformed returned data must still fail closed.
    function getEthUsdPriceWithStatus18() public view returns (uint256, bool) {
        try priceFeed.latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            require(answer > 0, "Invalid oracle price");
            require(updatedAt > 0 && updatedAt <= block.timestamp, "Invalid oracle timestamp");

            uint8 feedDecimals;
            try priceFeed.decimals() returns (uint8 decimals_) {
                feedDecimals = decimals_;
            } catch {
                return (0, false);
            }
            require(feedDecimals <= 18, "Unsupported oracle decimals");

            // Guard multiplication overflow even on unexpected mock feeds.
            uint256 factor = 10 ** (18 - feedDecimals);
            require(uint256(answer) <= type(uint256).max / factor, "Oracle price overflow");
            uint256 price18 = uint256(answer) * factor;
            bool fresh = block.timestamp - updatedAt <= maxAge;
            return (price18, fresh);
        } catch {
            // Chainlink call reverted (RPC/feed temporarily unavailable).
            return (0, false);
        }
    }
}
